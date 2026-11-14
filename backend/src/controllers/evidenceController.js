import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import { createCloudinaryClient, getCloudinaryEvidenceFolder } from "../config/cloudinary.js";
import { AppError } from "../errors/AppError.js";
import { validateEvidenceFile } from "../utils/evidence.js";

const SELFIE_TYPE = "VISIT_SELFIE";
const AUDIO_TYPE = "AUDIO_RECORDING";

function serializeMedia(media) {
    return {
        ...media,
        fileSizeBytes: media.fileSizeBytes === null || media.fileSizeBytes === undefined
            ? null
            : media.fileSizeBytes.toString(),
    };
}

function parseVisitId(value) {
    if (!/^\d+$/.test(value ?? "")) throw new AppError(400, "visitId must be a positive integer.");
    const visitId = Number(value);
    if (!Number.isSafeInteger(visitId) || visitId < 1) throw new AppError(400, "visitId must be a positive integer.");
    return visitId;
}

function uploadStream(client, buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = client.uploader.upload_stream(options, (error, result) => (error ? reject(error) : resolve(result)));
        stream.end(buffer);
    });
}

async function removeCloudinaryAsset(client, publicId, resourceType) {
    if (!publicId) return;
    try {
        await client.uploader.destroy(publicId, { resource_type: resourceType, type: "authenticated", invalidate: true });
    } catch {
        // Preserve the original persistence error and never expose Cloudinary details.
    }
}

function isTransactionConflict(error) {
    return error?.code === "P2034";
}

async function getEligibleVisit(prismaClient, visitId, userId) {
    const visit = await prismaClient.visit.findUnique({
        where: { id: visitId },
        select: {
            id: true,
            status: true,
            verificationResult: true,
            schedule: { select: { outsideSalesEmployeeId: true } },
        },
    });

    if (!visit) throw new AppError(404, "Visit not found.");
    if (visit.schedule.outsideSalesEmployeeId !== userId) throw new AppError(403, "You do not have permission to access this visit.");
    if (visit.verificationResult !== "PASSED") throw new AppError(409, "Visit location verification must pass before uploading evidence.");
    if (visit.status !== "IN_PROGRESS") throw new AppError(409, "Evidence cannot be uploaded for this visit.");
    return visit;
}

async function persistEvidence(prismaClient, { visitId, userId, mediaType, uploaded, resourceType, file }) {
    return prismaClient.$transaction(async (tx) => {
        const visit = await tx.visit.findUnique({
            where: { id: visitId },
            select: {
                id: true,
                status: true,
                verificationResult: true,
                schedule: { select: { outsideSalesEmployeeId: true } },
            },
        });
        if (!visit) throw new AppError(404, "Visit not found.");
        if (visit.schedule.outsideSalesEmployeeId !== userId) {
            throw new AppError(403, "You do not have permission to access this visit.");
        }
        if (visit.verificationResult !== "PASSED") {
            throw new AppError(409, "Visit location verification must pass before uploading evidence.");
        }
        if (visit.status !== "IN_PROGRESS") {
            throw new AppError(409, "Evidence cannot be uploaded for this visit.");
        }

        const lock = await tx.visit.updateMany({
            where: { id: visitId, status: "IN_PROGRESS", verificationResult: "PASSED" },
            data: { status: "IN_PROGRESS" },
        });
        if (lock.count !== 1) {
            throw new AppError(409, "Evidence cannot be uploaded for this visit.");
        }

        const currentVisit = await tx.visit.findUnique({
            where: { id: visitId },
            select: {
                id: true,
                status: true,
                verificationResult: true,
                schedule: { select: { outsideSalesEmployeeId: true } },
            },
        });
        if (!currentVisit) throw new AppError(404, "Visit not found.");
        if (currentVisit.schedule.outsideSalesEmployeeId !== userId) {
            throw new AppError(403, "You do not have permission to access this visit.");
        }
        if (currentVisit.verificationResult !== "PASSED") {
            throw new AppError(409, "Visit location verification must pass before uploading evidence.");
        }
        if (currentVisit.status !== "IN_PROGRESS") {
            throw new AppError(409, "Evidence cannot be uploaded for this visit.");
        }

        if (mediaType === SELFIE_TYPE) {
            const existing = await tx.mediaAsset.findFirst({ where: { visitId, mediaType } });
            if (existing) return { existing };
        }

        const media = await tx.mediaAsset.create({
            data: {
                visitId,
                uploadedByUserId: userId,
                mediaType,
                fileUrl: uploaded.secure_url,
                publicId: uploaded.public_id,
                assetId: uploaded.asset_id ?? null,
                resourceType: uploaded.resource_type ?? resourceType,
                deliveryType: uploaded.type ?? "authenticated",
                mimeType: file.mimetype,
                fileSizeBytes: BigInt(uploaded.bytes ?? file.size),
                durationSeconds: Number.isFinite(uploaded.duration) ? Math.round(uploaded.duration) : null,
            },
        });
        return { media };
    }, { isolationLevel: "Serializable" });
}

export function createEvidenceController({ prismaClient = prisma, cloudinaryClient, environment } = {}) {
    const getCloudinaryClient = () => cloudinaryClient ?? createCloudinaryClient(environment);

    async function uploadEvidence(req, res, kind) {
        const visitId = parseVisitId(req.params.visitId);
        await getEligibleVisit(prismaClient, visitId, req.user.id);
        validateEvidenceFile(req.file, kind);

        const mediaType = kind === "selfie" ? SELFIE_TYPE : AUDIO_TYPE;
        const resourceType = kind === "selfie" ? "image" : "video";
        if (kind === "selfie") {
            const existing = await prismaClient.mediaAsset.findFirst({ where: { visitId, mediaType } });
            if (existing) return res.status(200).json({ success: true, data: { media: serializeMedia(existing), created: false } });
        }

        const client = getCloudinaryClient();
        const evidenceFolder = getCloudinaryEvidenceFolder(environment);
        const uploaded = await uploadStream(client, req.file.buffer, {
            resource_type: resourceType,
            type: "authenticated",
            folder: `${evidenceFolder}/${visitId}`,
            public_id: `${kind}-${crypto.randomUUID()}`,
            overwrite: false,
        });

        try {
            const persisted = await persistEvidence(prismaClient, {
                visitId,
                userId: req.user.id,
                mediaType,
                uploaded,
                resourceType,
                file: req.file,
            });
            if (persisted.existing) {
                await removeCloudinaryAsset(client, uploaded.public_id, resourceType);
                return res.status(200).json({ success: true, data: { media: serializeMedia(persisted.existing), created: false } });
            }

            return res.status(201).json({ success: true, data: { media: serializeMedia(persisted.media), created: true } });
        } catch (error) {
            await removeCloudinaryAsset(client, uploaded.public_id, resourceType);
            if (isTransactionConflict(error)) {
                if (kind === "selfie") {
                    await getEligibleVisit(prismaClient, visitId, req.user.id);
                    const existing = await prismaClient.mediaAsset.findFirst({ where: { visitId, mediaType } });
                    if (existing) {
                        return res.status(200).json({ success: true, data: { media: serializeMedia(existing), created: false } });
                    }
                }
                throw new AppError(409, "Visit changed during evidence upload; retry the request.");
            }
            throw error;
        }
    }

    return {
        uploadSelfie: (req, res) => uploadEvidence(req, res, "selfie"),
        uploadAudio: (req, res) => uploadEvidence(req, res, "audio"),
    };
}
