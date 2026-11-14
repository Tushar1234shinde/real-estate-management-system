import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { calculateHaversineDistanceMeters, validateLocationPayload } from "../utils/location.js";

const visitSelect = {
    id: true,
    scheduleId: true,
    status: true,
    reachedLatitude: true,
    reachedLongitude: true,
    reachedAt: true,
    completedAt: true,
    verificationResult: true,
    verificationCheckedAt: true,
    verificationDistanceMeters: true,
};
const EXECUTABLE_SCHEDULE_STATUSES = ["SCHEDULED", "RESCHEDULED"];

function parseScheduleId(value) {
    if (!/^\d+$/.test(value ?? "")) {
        throw new AppError(400, "scheduleId must be a positive integer.");
    }

    const scheduleId = Number(value);

    if (!Number.isSafeInteger(scheduleId) || scheduleId < 1) {
        throw new AppError(400, "scheduleId must be a positive integer.");
    }

    return scheduleId;
}

function parseVisitId(value) {
    if (!/^\d+$/.test(value ?? "")) {
        throw new AppError(400, "visitId must be a positive integer.");
    }

    const visitId = Number(value);

    if (!Number.isSafeInteger(visitId) || visitId < 1) {
        throw new AppError(400, "visitId must be a positive integer.");
    }

    return visitId;
}

function isUniqueConstraintError(error) {
    return error?.code === "P2002";
}

export function createVisitScheduleController({ prismaClient = prisma } = {}) {
    return {
        initializeVisit: async (req, res) => {
            const scheduleId = parseScheduleId(req.params.scheduleId);
            const findCurrentSchedule = () => prismaClient.visitSchedule.findUnique({
                where: { id: scheduleId },
                select: {
                    id: true,
                    outsideSalesEmployeeId: true,
                    status: true,
                    visit: { select: visitSelect },
                },
            });
            let result;

            try {
                result = await prismaClient.$transaction(async (tx) => {
                    const schedule = await tx.visitSchedule.findUnique({
                        where: { id: scheduleId },
                        select: {
                            id: true,
                            outsideSalesEmployeeId: true,
                            status: true,
                            visit: { select: visitSelect },
                        },
                    });
                    if (!schedule) throw new AppError(404, "Visit schedule not found.");
                    if (schedule.outsideSalesEmployeeId !== req.user.id) {
                        throw new AppError(403, "You do not have permission to access this visit schedule.");
                    }
                    if (!EXECUTABLE_SCHEDULE_STATUSES.includes(schedule.status)) {
                        throw new AppError(409, "This visit schedule is not available for execution.");
                    }
                    if (schedule.visit) return { visit: schedule.visit, created: false };

                    const scheduleLock = await tx.visitSchedule.updateMany({
                        where: {
                            id: scheduleId,
                            outsideSalesEmployeeId: req.user.id,
                            status: { in: EXECUTABLE_SCHEDULE_STATUSES },
                        },
                        data: { status: schedule.status },
                    });
                    if (scheduleLock.count !== 1) {
                        const error = new Error("Visit schedule changed during initialization.");
                        error.code = "P2034";
                        throw error;
                    }

                    const visit = await tx.visit.create({
                        data: { scheduleId },
                        select: visitSelect,
                    });
                    return { visit, created: true };
                }, { isolationLevel: "Serializable" });
            } catch (error) {
                if (!isUniqueConstraintError(error) && error?.code !== "P2034") throw error;

                const schedule = await findCurrentSchedule();
                if (!schedule) throw new AppError(404, "Visit schedule not found.");
                if (schedule.outsideSalesEmployeeId !== req.user.id) {
                    throw new AppError(403, "You do not have permission to access this visit schedule.");
                }
                if (!EXECUTABLE_SCHEDULE_STATUSES.includes(schedule.status)) {
                    throw new AppError(409, "This visit schedule is not available for execution.");
                }
                if (schedule.visit) {
                    result = { visit: schedule.visit, created: false };
                } else if (error?.code === "P2034") {
                    throw new AppError(409, "Visit schedule changed during initialization; retry the request.");
                } else {
                    throw error;
                }
            }

            return res.status(result.created ? 201 : 200).json({ success: true, data: result });
        },
        verifyLocation: async (req, res) => {
            const visitId = parseVisitId(req.params.visitId);
            const visit = await prismaClient.visit.findUnique({
                where: { id: visitId },
                select: {
                    ...visitSelect,
                    schedule: {
                        select: {
                            outsideSalesEmployeeId: true,
                            property: {
                                select: {
                                    latitude: true,
                                    longitude: true,
                                    verificationRadiusMeters: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!visit) {
                throw new AppError(404, "Visit not found.");
            }

            if (visit.schedule.outsideSalesEmployeeId !== req.user.id) {
                throw new AppError(403, "You do not have permission to access this visit.");
            }

            if (visit.verificationCheckedAt || visit.verificationResult !== "PENDING") {
                return res.status(200).json({
                    success: true,
                    data: { visit, verified: false },
                });
            }

            if (visit.status !== "IN_PROGRESS") {
                throw new AppError(409, "This visit can no longer be verified.");
            }

            const location = validateLocationPayload(req.body);

            const { property } = visit.schedule;

            if (property.latitude === null || property.longitude === null) {
                throw new AppError(422, "Property coordinates are not configured for this visit.");
            }

            const distance = calculateHaversineDistanceMeters(
                location.latitude,
                location.longitude,
                property.latitude,
                property.longitude,
            );
            const verificationResult = distance <= property.verificationRadiusMeters ? "PASSED" : "FAILED";
            const update = await prismaClient.visit.updateMany({
                where: {
                    id: visitId,
                    status: "IN_PROGRESS",
                    verificationResult: "PENDING",
                    verificationCheckedAt: null,
                },
                data: {
                    reachedLatitude: location.latitude,
                    reachedLongitude: location.longitude,
                    verificationDistanceMeters: distance,
                    verificationResult,
                    verificationCheckedAt: new Date(),
                },
            });

            if (update.count === 0) {
                const existingVisit = await prismaClient.visit.findUnique({
                    where: { id: visitId },
                    select: visitSelect,
                });

                if (!existingVisit) {
                    throw new AppError(404, "Visit not found.");
                }

                return res.status(200).json({
                    success: true,
                    data: { visit: existingVisit, verified: false },
                });
            }

            const verifiedVisit = await prismaClient.visit.findUnique({
                where: { id: visitId },
                select: visitSelect,
            });

            return res.status(200).json({
                success: true,
                data: { visit: verifiedVisit, verified: true },
            });
        },
    };
}
