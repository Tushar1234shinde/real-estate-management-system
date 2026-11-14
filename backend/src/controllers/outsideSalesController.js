import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const scheduleInclude = {
    customer: {
        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
        },
    },
    property: {
        select: {
            id: true,
            title: true,
            location: true,
            latitude: true,
            longitude: true,
            verificationRadiusMeters: true,
            status: true,
        },
    },
    visit: {
        select: {
            id: true,
            status: true,
            reachedAt: true,
            completedAt: true,
            verificationResult: true,
            verificationCheckedAt: true,
            verificationDistanceMeters: true,
        },
    },
};

function maskPhone(phone) {
    if (typeof phone !== "string") return phone ?? null;
    const lastFour = phone.replace(/\D/g, "").slice(-4);
    return lastFour ? `****${lastFour}` : null;
}

function presentSchedule(schedule) {
    return {
        ...schedule,
        customer: schedule.customer ? { ...schedule.customer, phone: maskPhone(schedule.customer.phone) } : schedule.customer,
    };
}

function parsePositiveInteger(value, fallback, fieldName, maximum) {
    if (value === undefined) {
        return fallback;
    }

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

export function createOutsideSalesController({ prismaClient = prisma } = {}) {
    return {
        listAssignedVisitSchedules: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const where = { outsideSalesEmployeeId: req.user.id };
            const skip = (page - 1) * pageSize;

            if (!Number.isSafeInteger(skip)) {
                throw new AppError(400, "page is too large.");
            }

            const [schedules, total] = await prismaClient.$transaction([
                prismaClient.visitSchedule.findMany({
                    where,
                    include: scheduleInclude,
                    orderBy: [
                        { scheduledAt: "asc" },
                        { id: "asc" },
                    ],
                    skip,
                    take: pageSize,
                }),
                prismaClient.visitSchedule.count({ where }),
            ]);

            res.status(200).json({
                success: true,
                data: {
                    schedules: schedules.map(presentSchedule),
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize),
                    },
                },
            });
        },
    };
}

export { scheduleInclude };
