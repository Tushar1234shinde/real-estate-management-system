import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import {
    createCloudinaryClient,
    getCloudinaryPropertyDocumentsFolder,
} from "../config/cloudinary.js";
import { AppError } from "../errors/AppError.js";
import { validatePropertyDocumentFile } from "../utils/propertyDocuments.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ACCESS_URL_LIFETIME_SECONDS = 5 * 60;

const documentSelect = {
    id: true,
    propertyId: true,
    uploadedByUserId: true,
    documentName: true,
    mimeType: true,
    fileSizeBytes: true,
    uploadedAt: true,
    uploadedBy: { select: { id: true, fullName: true } },
};

function parsePositiveInteger(value, fieldName, fallback, maximum) {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
        throw new AppError(400, maximum
            ? `${fieldName} must be between 1 and ${maximum}.`
            : `${fieldName} must be a positive integer.`);
    }
    return parsed;
}

function serializeDocument(document) {
    return {
        id: document.id,
        propertyId: document.propertyId,
        uploadedByUserId: document.uploadedByUserId,
        documentName: document.documentName,
        originalFileName: document.documentName,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes === null || document.fileSizeBytes === undefined
            ? null
            : document.fileSizeBytes.toString(),
        uploadedAt: document.uploadedAt,
        uploadedBy: document.uploadedBy,
    };
}

function accessiblePropertyWhere(propertyId, user) {
    if (user.role === "ADMIN" || user.role === "EXECUTIVE") return { id: propertyId };
    if (user.role === "INSIDE_SALES") return { id: propertyId, status: "AVAILABLE" };
    if (user.role === "OUTSIDE_SALES") {
        return {
            id: propertyId,
            visitSchedules: { some: { outsideSalesEmployeeId: user.id } },
        };
    }
    throw new AppError(403, "You do not have permission to access property documents.");
}

async function findAccessibleProperty(prismaClient, propertyId, user) {
    const where = accessiblePropertyWhere(propertyId, user);
    return user.role === "ADMIN" || user.role === "EXECUTIVE"
        ? prismaClient.property.findUnique({ where, select: { id: true } })
        : prismaClient.property.findFirst({ where, select: { id: true } });
}

function uploadStream(client, buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = client.uploader.upload_stream(options, (error, result) => (
            error ? reject(error) : resolve(result)
        ));
        stream.end(buffer);
    });
}

async function destroyCloudinaryAsset(client, publicId, resourceType) {
    try {
        const result = await client.uploader.destroy(publicId, {
            resource_type: resourceType,
            type: "authenticated",
            invalidate: true,
        });
        return result?.result === "ok" || result?.result === "not found";
    } catch {
        return false;
    }
}

async function cleanupUploadedAssets(client, assets) {
    if (assets.length === 0) return;
    const outcomes = await Promise.all(assets.map(({ publicId, resourceType }) => (
        destroyCloudinaryAsset(client, publicId, resourceType)
    )));
    const failedCount = outcomes.filter((success) => !success).length;
    if (failedCount > 0) {
        console.error(JSON.stringify({
            level: "error",
            event: "property_document_asset_cleanup_failed",
            failedCount,
        }));
    }
}

function mapUploadResult(uploaded, file, validatedFile, publicId) {
    const expectedResourceType = validatedFile.resourceType;
    if (!uploaded
        || uploaded.public_id !== publicId
        || uploaded.resource_type !== expectedResourceType
        || uploaded.type !== "authenticated"
        || typeof uploaded.secure_url !== "string"
        || !uploaded.secure_url.startsWith("https://")) {
        throw new AppError(502, "Property document upload failed.");
    }

    return {
        publicId: uploaded.public_id,
        assetId: typeof uploaded.asset_id === "string" ? uploaded.asset_id : null,
        resourceType: expectedResourceType,
        deliveryType: "authenticated",
        documentUrl: uploaded.secure_url,
        documentName: validatedFile.originalFileName,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(Number.isSafeInteger(uploaded.bytes) && uploaded.bytes > 0
            ? uploaded.bytes
            : file.size),
    };
}

export function createPropertyDocumentsController({
    prismaClient = prisma,
    cloudinaryClient,
    environment,
} = {}) {
    const getCloudinaryClient = () => cloudinaryClient
        ?? createCloudinaryClient(environment, "Property document");

    return {
        uploadDocuments: async (req, res) => {
            const propertyId = parsePositiveInteger(req.params.propertyId, "propertyId");
            if (!await findAccessibleProperty(prismaClient, propertyId, req.user)) {
                throw new AppError(404, "Property not found.");
            }
            if (!Array.isArray(req.files) || req.files.length === 0) {
                throw new AppError(400, "At least one property document file is required in the files field.");
            }
            const validatedFiles = req.files.map((file) => validatePropertyDocumentFile(file));
            const client = getCloudinaryClient();
            const folder = getCloudinaryPropertyDocumentsFolder(environment);
            const uploadedAssets = [];
            const records = [];

            for (let index = 0; index < req.files.length; index += 1) {
                const file = req.files[index];
                const validatedFile = validatedFiles[index];
                const publicId = `document-${crypto.randomUUID()}`;
                const asset = { publicId, resourceType: validatedFile.resourceType };
                uploadedAssets.push(asset);
                try {
                    const uploaded = await uploadStream(client, file.buffer, {
                        resource_type: validatedFile.resourceType,
                        type: "authenticated",
                        folder: `${folder}/${propertyId}`,
                        public_id: publicId,
                        overwrite: false,
                    });
                    if (typeof uploaded?.public_id === "string" && uploaded.public_id !== publicId) {
                        uploadedAssets.push({
                            publicId: uploaded.public_id,
                            resourceType: uploaded.resource_type ?? validatedFile.resourceType,
                        });
                    }
                    records.push(mapUploadResult(uploaded, file, validatedFile, publicId));
                } catch (error) {
                    await cleanupUploadedAssets(client, uploadedAssets);
                    if (error instanceof AppError) throw error;
                    throw new AppError(502, "Property document upload failed.");
                }
            }

            try {
                const documents = await prismaClient.$transaction(async (tx) => {
                    if (!await findAccessibleProperty(tx, propertyId, req.user)) {
                        throw new AppError(404, "Property not found.");
                    }
                    const saved = [];
                    for (const record of records) {
                        saved.push(await tx.propertyDocument.create({
                            data: {
                                propertyId,
                                uploadedByUserId: req.user.id,
                                ...record,
                            },
                            select: documentSelect,
                        }));
                    }
                    return saved;
                });
                return res.status(201).json({
                    success: true,
                    data: { documents: documents.map(serializeDocument) },
                });
            } catch (error) {
                await cleanupUploadedAssets(client, uploadedAssets);
                throw error;
            }
        },

        listDocuments: async (req, res) => {
            const propertyId = parsePositiveInteger(req.params.propertyId, "propertyId");
            const page = parsePositiveInteger(req.query.page, "page", DEFAULT_PAGE);
            const pageSize = parsePositiveInteger(req.query.pageSize, "pageSize", DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");
            if (!await findAccessibleProperty(prismaClient, propertyId, req.user)) {
                throw new AppError(404, "Property not found.");
            }
            const where = { propertyId };
            const [documents, total] = await prismaClient.$transaction([
                prismaClient.propertyDocument.findMany({
                    where,
                    select: documentSelect,
                    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.propertyDocument.count({ where }),
            ]);
            return res.status(200).json({
                success: true,
                data: {
                    documents: documents.map(serializeDocument),
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
                },
            });
        },

        getDocumentAccess: async (req, res) => {
            const propertyId = parsePositiveInteger(req.params.propertyId, "propertyId");
            const documentId = parsePositiveInteger(req.params.documentId, "documentId");
            if (!await findAccessibleProperty(prismaClient, propertyId, req.user)) {
                throw new AppError(404, "Property not found.");
            }
            const document = await prismaClient.propertyDocument.findFirst({
                where: { id: documentId, propertyId },
                select: {
                    id: true,
                    documentName: true,
                    publicId: true,
                    resourceType: true,
                    deliveryType: true,
                },
            });
            if (!document) throw new AppError(404, "Property document not found.");
            if (!document.publicId
                || !["image", "raw"].includes(document.resourceType)
                || document.deliveryType !== "authenticated") {
                throw new AppError(409, "Secure access is unavailable for this property document.");
            }

            const extension = document.documentName.includes(".")
                ? document.documentName.slice(document.documentName.lastIndexOf(".") + 1).toLowerCase()
                : "";
            if (!Object.hasOwn({
                jpg: true, jpeg: true, png: true, webp: true, pdf: true,
            }, extension)) {
                throw new AppError(409, "Secure access is unavailable for this property document.");
            }
            const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_URL_LIFETIME_SECONDS;
            let url;
            try {
                url = getCloudinaryClient().utils.private_download_url(
                    document.publicId,
                    extension,
                    {
                        resource_type: document.resourceType,
                        type: document.deliveryType,
                        expires_at: expiresAt,
                        attachment: true,
                    },
                );
            } catch {
                throw new AppError(503, "Secure document access is temporarily unavailable.");
            }
            if (typeof url !== "string" || !url.startsWith("https://")) {
                throw new AppError(503, "Secure document access is temporarily unavailable.");
            }
            return res.status(200).json({
                success: true,
                data: { documentId, url, expiresAt: new Date(expiresAt * 1000).toISOString() },
            });
        },

        deleteDocument: async (req, res) => {
            const propertyId = parsePositiveInteger(req.params.propertyId, "propertyId");
            const documentId = parsePositiveInteger(req.params.documentId, "documentId");
            if (!await findAccessibleProperty(prismaClient, propertyId, req.user)) {
                throw new AppError(404, "Property not found.");
            }
            const document = await prismaClient.propertyDocument.findFirst({
                where: { id: documentId, propertyId },
                select: {
                    id: true,
                    publicId: true,
                    resourceType: true,
                    deliveryType: true,
                    _count: { select: { messageAttachments: true } },
                },
            });
            if (!document) throw new AppError(404, "Property document not found.");
            if (document._count.messageAttachments > 0) {
                throw new AppError(409, "A property document attached to a message cannot be deleted.");
            }
            if (!document.publicId
                || !["image", "raw"].includes(document.resourceType)
                || document.deliveryType !== "authenticated") {
                throw new AppError(409, "The private storage metadata for this document is unavailable.");
            }

            const deleted = await destroyCloudinaryAsset(
                getCloudinaryClient(),
                document.publicId,
                document.resourceType,
            );
            if (!deleted) throw new AppError(502, "Property document could not be deleted.");
            await prismaClient.propertyDocument.delete({ where: { id: document.id } });
            return res.status(200).json({ success: true, data: { documentId, deleted: true } });
        },
    };
}
