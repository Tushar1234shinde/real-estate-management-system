import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const reviewInclude = {
    schedule: {
        select: {
            id: true,
            scheduledAt: true,
            notes: true,
            customer: { select: { id: true, fullName: true, email: true, phone: true } },
            property: {
                select: {
                    id: true,
                    title: true,
                    location: true,
                    latitude: true,
                    longitude: true,
                    verificationRadiusMeters: true,
                },
            },
            outsideSalesEmployee: { select: { id: true, fullName: true, email: true } },
        },
    },
    mediaAssets: {
        select: {
            id: true,
            mediaType: true,
            fileUrl: true,
            mimeType: true,
            fileSizeBytes: true,
            durationSeconds: true,
            uploadedAt: true,
        },
        orderBy: { uploadedAt: "asc" },
    },
};

function parseVisitId(value) {
    if (!/^\d+$/.test(value ?? "")) throw new AppError(400, "visitId must be a positive integer.");
    const visitId = Number(value);
    if (!Number.isSafeInteger(visitId) || visitId < 1) throw new AppError(400, "visitId must be a positive integer.");
    return visitId;
}

function parsePositiveInteger(value, fallback, fieldName, maximum) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
        throw new AppError(400, maximum ? `${fieldName} must be between 1 and ${maximum}.` : `${fieldName} must be a positive integer.`);
    }
    return parsed;
}

function serializeBigInts(value) {
    if (Array.isArray(value)) return value.map(serializeBigInts);
    if (value instanceof Date) return value;
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "bigint" ? item.toString() : serializeBigInts(item)]));
}

function parseRejectionReason(value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, "rejectionReason is required.");
    }
    const reason = value.trim();
    if (reason.length > 1000) throw new AppError(400, "rejectionReason must be 1000 characters or fewer.");
    return reason;
}

export function createAdminVisitReviewController({ prismaClient = prisma } = {}) {
    async function decide(req, res, decision) {
        const visitId = parseVisitId(req.params.visitId);
        const rejectionReason = decision === "REJECTED" ? parseRejectionReason(req.body?.rejectionReason) : null;
        const result = await prismaClient.$transaction(async (tx) => {
            const visit = await tx.visit.findUnique({ where: { id: visitId }, select: { id: true, status: true } });
            if (!visit) throw new AppError(404, "Visit not found.");
            if (visit.status !== "PENDING_REVIEW") throw new AppError(409, "Visit is not pending review.");

            const update = await tx.visit.updateMany({
                where: { id: visitId, status: "PENDING_REVIEW" },
                data: {
                    status: decision,
                    reviewerId: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason,
                },
            });
            if (update.count !== 1) throw new AppError(409, "Visit has already been reviewed.");

            const history = await tx.visitStatusHistory.create({
                data: {
                    visitId,
                    previousStatus: "PENDING_REVIEW",
                    newStatus: decision,
                    changedByUserId: req.user.id,
                    reason: rejectionReason ?? "Approved by reviewer.",
                },
            });
            return { visit: { ...visit, status: decision, reviewerId: req.user.id, rejectionReason }, history };
        });

        return res.status(200).json({ success: true, data: result });
    }

    return {
        listPendingReviews: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");
            const where = { status: "PENDING_REVIEW" };
            const [visits, total] = await prismaClient.$transaction([
                prismaClient.visit.findMany({ where, include: reviewInclude, orderBy: { id: "asc" }, skip, take: pageSize }),
                prismaClient.visit.count({ where }),
            ]);
            return res.status(200).json({
                success: true,
                data: {
                    visits: serializeBigInts(visits),
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
                },
            });
        },
        getReviewDetails: async (req, res) => {
            const visitId = parseVisitId(req.params.visitId);
            const visit = await prismaClient.visit.findUnique({ where: { id: visitId }, include: reviewInclude });
            if (!visit) throw new AppError(404, "Visit not found.");
            return res.status(200).json({ success: true, data: { visit: serializeBigInts(visit) } });
        },
        approveVisit: (req, res) => decide(req, res, "COMPLETED"),
        rejectVisit: (req, res) => decide(req, res, "REJECTED"),
    };
}
