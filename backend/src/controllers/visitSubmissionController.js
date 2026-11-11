import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const SELFIE_TYPE = "VISIT_SELFIE";

function parseVisitId(value) {
    if (!/^\d+$/.test(value ?? "")) throw new AppError(400, "visitId must be a positive integer.");
    const visitId = Number(value);
    if (!Number.isSafeInteger(visitId) || visitId < 1) throw new AppError(400, "visitId must be a positive integer.");
    return visitId;
}

const visitWithOwnerSelect = {
    id: true,
    status: true,
    verificationResult: true,
    schedule: { select: { outsideSalesEmployeeId: true } },
};

export function createVisitSubmissionController({ prismaClient = prisma } = {}) {
    return {
        submitVisit: async (req, res) => {
            const visitId = parseVisitId(req.params.visitId);
            const visit = await prismaClient.visit.findUnique({ where: { id: visitId }, select: visitWithOwnerSelect });

            if (!visit) throw new AppError(404, "Visit not found.");
            if (visit.schedule.outsideSalesEmployeeId !== req.user.id) {
                throw new AppError(403, "You do not have permission to access this visit.");
            }
            if (visit.verificationResult !== "PASSED") {
                throw new AppError(409, "Visit location verification must pass before submission.");
            }
            if (visit.status !== "IN_PROGRESS") {
                throw new AppError(409, "This visit has already been submitted or cannot be submitted.");
            }

            const result = await prismaClient.$transaction(async (tx) => {
                const currentVisit = await tx.visit.findUnique({ where: { id: visitId }, select: visitWithOwnerSelect });

                if (!currentVisit || currentVisit.schedule.outsideSalesEmployeeId !== req.user.id) {
                    throw new AppError(403, "You do not have permission to access this visit.");
                }
                if (currentVisit.verificationResult !== "PASSED") {
                    throw new AppError(409, "Visit location verification must pass before submission.");
                }
                if (currentVisit.status !== "IN_PROGRESS") {
                    throw new AppError(409, "This visit has already been submitted or cannot be submitted.");
                }

                const selfieCount = await tx.mediaAsset.count({ where: { visitId, mediaType: SELFIE_TYPE } });
                if (selfieCount !== 1) {
                    throw new AppError(409, "Exactly one visit selfie is required before submission.");
                }

                const update = await tx.visit.updateMany({
                    where: { id: visitId, status: "IN_PROGRESS", verificationResult: "PASSED" },
                    data: { status: "PENDING_REVIEW" },
                });
                if (update.count !== 1) {
                    throw new AppError(409, "This visit has already been submitted or cannot be submitted.");
                }

                const history = await tx.visitStatusHistory.create({
                    data: {
                        visitId,
                        previousStatus: "IN_PROGRESS",
                        newStatus: "PENDING_REVIEW",
                        changedByUserId: req.user.id,
                        reason: "Submitted by Outside Sales employee for review.",
                    },
                });

                return { visit: { ...currentVisit, status: "PENDING_REVIEW" }, history };
            });

            return res.status(200).json({ success: true, data: result });
        },
    };
}
