import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_NOTES_LENGTH = 2_000;
const ACTIVE_SCHEDULE_STATUSES = ["SCHEDULED", "RESCHEDULED"];
const MAX_TRANSACTION_RETRIES = 3;
const CALL_OUTCOMES = new Set(["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"]);
const INTEREST_STATUSES = new Set(["PENDING", "INTERESTED", "NOT_INTERESTED"]);
const INTEREST_STATUS_VALUES = ["PENDING", "INTERESTED", "NOT_INTERESTED"];
const CALL_OUTCOME_VALUES = ["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"];
const VISIT_SCHEDULE_STATUS_VALUES = ["SCHEDULED", "RESCHEDULED", "CANCELLED", "COMPLETED"];

const customerSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    address: true,
    status: true,
    interestStatus: true,
    createdAt: true,
    updatedAt: true,
    assignment: { select: { assignedAt: true } },
};

const callLogSelect = {
    id: true,
    customerId: true,
    employeeId: true,
    propertyId: true,
    outcome: true,
    notes: true,
    calledAt: true,
};

const propertySelect = {
    id: true,
    title: true,
    description: true,
    location: true,
    latitude: true,
    longitude: true,
    verificationRadiusMeters: true,
    price: true,
    status: true,
};

const scheduleSelect = {
    id: true,
    customerId: true,
    propertyId: true,
    insideSalesEmployeeId: true,
    outsideSalesEmployeeId: true,
    scheduledByUserId: true,
    scheduledAt: true,
    status: true,
    notes: true,
    createdAt: true,
    customer: { select: { id: true, fullName: true, email: true, phone: true } },
    property: { select: propertySelect },
    outsideSalesEmployee: { select: { id: true, fullName: true, email: true, phone: true } },
    visit: { select: { id: true, status: true } },
};

function parsePositiveInteger(value, fieldName) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }
    return parsed;
}

function parsePagination(value, fallback, fieldName, maximum) {
    if (value === undefined) return fallback;
    const parsed = parsePositiveInteger(value, fieldName);
    if (maximum && parsed > maximum) {
        throw new AppError(400, `${fieldName} must be between 1 and ${maximum}.`);
    }
    return parsed;
}

function requireObjectBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new AppError(400, "Request body must be a JSON object.");
    }
}

function rejectUnexpectedFields(body, fields) {
    if (Object.keys(body).some((field) => !fields.has(field))) {
        throw new AppError(400, "Request body contains unsupported fields.");
    }
}

function parseCallLogBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["outcome", "notes", "propertyId"]));

    if (typeof body.outcome !== "string" || !CALL_OUTCOMES.has(body.outcome)) {
        throw new AppError(400, "outcome must be a valid call outcome.");
    }
    if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.trim().length > MAX_NOTES_LENGTH)) {
        throw new AppError(400, `notes must be a string no longer than ${MAX_NOTES_LENGTH} characters.`);
    }

    let propertyId;
    if (body.propertyId !== undefined) {
        if (!Number.isSafeInteger(body.propertyId) || body.propertyId < 1) {
            throw new AppError(400, "propertyId must be a positive integer.");
        }
        propertyId = body.propertyId;
    }

    return { outcome: body.outcome, notes: body.notes?.trim() || null, propertyId };
}

function parseInterestBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["interestStatus"]));
    if (typeof body.interestStatus !== "string" || !INTEREST_STATUSES.has(body.interestStatus)) {
        throw new AppError(400, "interestStatus must be PENDING, INTERESTED, or NOT_INTERESTED.");
    }
    return body.interestStatus;
}

function parseDateTime(value, fieldName) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        throw new AppError(400, `${fieldName} must be an ISO 8601 date-time with a timezone.`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError(400, `${fieldName} must be a valid date-time.`);
    }
    return parsed;
}

function parseNotes(value) {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.trim().length > MAX_NOTES_LENGTH) {
        throw new AppError(400, `notes must be a string no longer than ${MAX_NOTES_LENGTH} characters.`);
    }
    return value.trim() || null;
}

function parseCreateScheduleBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["customerId", "propertyId", "outsideSalesEmployeeId", "scheduledAt", "notes"]));
    for (const fieldName of ["customerId", "propertyId", "outsideSalesEmployeeId"]) {
        if (!Number.isSafeInteger(body[fieldName]) || body[fieldName] < 1) {
            throw new AppError(400, `${fieldName} must be a positive integer.`);
        }
    }
    return {
        customerId: body.customerId,
        propertyId: body.propertyId,
        outsideSalesEmployeeId: body.outsideSalesEmployeeId,
        scheduledAt: parseDateTime(body.scheduledAt, "scheduledAt"),
        notes: parseNotes(body.notes) ?? null,
    };
}

function parseUpdateScheduleBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["scheduledAt", "status", "notes"]));
    const hasScheduledAt = body.scheduledAt !== undefined;
    const hasStatus = body.status !== undefined;
    if (hasScheduledAt === hasStatus) {
        throw new AppError(400, "Provide either scheduledAt to reschedule or status CANCELLED to cancel.");
    }
    if (hasStatus && body.status !== "CANCELLED") {
        throw new AppError(400, "Only cancellation is supported through status.");
    }
    return {
        action: hasStatus ? "cancel" : "reschedule",
        scheduledAt: hasScheduledAt ? parseDateTime(body.scheduledAt, "scheduledAt") : undefined,
        notes: parseNotes(body.notes),
    };
}

function assignedCustomerWhere(customerId, employeeId) {
    return {
        ...(customerId === undefined ? {} : { id: customerId }),
        assignment: { is: { insideSalesEmployeeId: employeeId } },
    };
}

function ownedScheduleWhere(scheduleId, employeeId) {
    return { id: scheduleId, insideSalesEmployeeId: employeeId };
}

function activeDuplicateScheduleWhere({ customerId, propertyId, outsideSalesEmployeeId, scheduledAt, excludeScheduleId }) {
    return {
        customerId,
        propertyId,
        outsideSalesEmployeeId,
        scheduledAt,
        status: { in: ACTIVE_SCHEDULE_STATUSES },
        ...(excludeScheduleId === undefined ? {} : { id: { not: excludeScheduleId } }),
    };
}

function isSerializationConflict(error) {
    return error?.code === "P2034";
}

function countsByEnum(values, counts) {
    return Object.fromEntries(values.map((value, index) => [value, counts[index] ?? 0]));
}

function safeProfile(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        role: user.role.name,
    };
}

function maskPhone(phone) {
    if (typeof phone !== "string") return phone ?? null;
    const lastFour = phone.replace(/\D/g, "").slice(-4);
    return lastFour ? `****${lastFour}` : null;
}

function presentCustomer(customer) {
    return { ...customer, phone: maskPhone(customer.phone) };
}

function presentSchedule(schedule) {
    return {
        ...schedule,
        customer: schedule.customer ? presentCustomer(schedule.customer) : schedule.customer,
        outsideSalesEmployee: schedule.outsideSalesEmployee
            ? { ...schedule.outsideSalesEmployee, phone: maskPhone(schedule.outsideSalesEmployee.phone) }
            : schedule.outsideSalesEmployee,
    };
}

export function createInsideSalesController({ prismaClient = prisma } = {}) {
    return {
        listAssignedCustomers: async (req, res) => {
            const page = parsePagination(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePagination(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");

            const where = assignedCustomerWhere(undefined, req.user.id);
            const [customers, total] = await prismaClient.$transaction([
                prismaClient.customer.findMany({
                    where,
                    select: customerSelect,
                    orderBy: [{ assignment: { assignedAt: "desc" } }, { id: "asc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.customer.count({ where }),
            ]);

            res.status(200).json({
                success: true,
                data: { customers: customers.map(presentCustomer), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        getAssignedCustomer: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const customer = await prismaClient.customer.findFirst({
                where: assignedCustomerWhere(customerId, req.user.id),
                select: customerSelect,
            });
            if (!customer) throw new AppError(404, "Customer not found.");
            res.status(200).json({ success: true, data: { customer: presentCustomer(customer) } });
        },

        listCallLogs: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const customer = await prismaClient.customer.findFirst({
                where: assignedCustomerWhere(customerId, req.user.id),
                select: { id: true },
            });
            if (!customer) throw new AppError(404, "Customer not found.");

            const callLogs = await prismaClient.callLog.findMany({
                where: {
                    customerId,
                    employeeId: req.user.id,
                    customer: { assignment: { is: { insideSalesEmployeeId: req.user.id } } },
                },
                select: callLogSelect,
                orderBy: [{ calledAt: "desc" }, { id: "desc" }],
            });
            res.status(200).json({ success: true, data: { callLogs } });
        },

        createCallLog: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const body = parseCallLogBody(req.body);
            const customer = await prismaClient.customer.findFirst({
                where: assignedCustomerWhere(customerId, req.user.id),
                select: { id: true },
            });
            if (!customer) throw new AppError(404, "Customer not found.");

            if (body.propertyId !== undefined) {
                const property = await prismaClient.property.findUnique({
                    where: { id: body.propertyId },
                    select: { id: true },
                });
                if (!property) throw new AppError(404, "Property not found.");
            }

            const callLog = await prismaClient.callLog.create({
                data: { customerId, employeeId: req.user.id, ...body },
                select: callLogSelect,
            });
            res.status(201).json({ success: true, data: { callLog } });
        },

        updateInterest: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const interestStatus = parseInterestBody(req.body);
            const update = await prismaClient.customer.updateMany({
                where: assignedCustomerWhere(customerId, req.user.id),
                data: { interestStatus },
            });
            if (update.count === 0) throw new AppError(404, "Customer not found.");

            const customer = await prismaClient.customer.findFirst({
                where: assignedCustomerWhere(customerId, req.user.id),
                select: customerSelect,
            });
            res.status(200).json({ success: true, data: { customer: presentCustomer(customer) } });
        },

        listAvailableProperties: async (req, res) => {
            const page = parsePagination(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePagination(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");

            const where = { status: "AVAILABLE" };
            const [properties, total] = await prismaClient.$transaction([
                prismaClient.property.findMany({
                    where,
                    select: propertySelect,
                    orderBy: [{ title: "asc" }, { id: "asc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.property.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: { properties, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        listOwnedVisitSchedules: async (req, res) => {
            const page = parsePagination(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePagination(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");

            const where = { insideSalesEmployeeId: req.user.id };
            const [schedules, total] = await prismaClient.$transaction([
                prismaClient.visitSchedule.findMany({
                    where,
                    select: scheduleSelect,
                    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.visitSchedule.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: { schedules: schedules.map(presentSchedule), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        createVisitSchedule: async (req, res) => {
            const input = parseCreateScheduleBody(req.body);
            let schedule;

            for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
                try {
                    schedule = await prismaClient.$transaction(async (tx) => {
                        const [customer, property, outsideSalesEmployee] = await Promise.all([
                            tx.customer.findFirst({ where: assignedCustomerWhere(input.customerId, req.user.id), select: { id: true } }),
                            tx.property.findFirst({ where: { id: input.propertyId, status: "AVAILABLE" }, select: { id: true } }),
                            tx.user.findFirst({
                                where: { id: input.outsideSalesEmployeeId, isActive: true, role: { name: "OUTSIDE_SALES" } },
                                select: { id: true },
                            }),
                        ]);
                        if (!customer) throw new AppError(404, "Customer not found.");
                        if (!property) throw new AppError(409, "Property is not available.");
                        if (!outsideSalesEmployee) throw new AppError(400, "outsideSalesEmployeeId must identify an active OUTSIDE_SALES employee.");

                        const duplicate = await tx.visitSchedule.findFirst({
                            where: activeDuplicateScheduleWhere(input),
                            select: { id: true },
                        });
                        if (duplicate) throw new AppError(409, "An active matching visit schedule already exists.");

                        return tx.visitSchedule.create({
                            data: { ...input, insideSalesEmployeeId: req.user.id, scheduledByUserId: req.user.id },
                            select: scheduleSelect,
                        });
                    }, { isolationLevel: "Serializable" });
                    break;
                } catch (error) {
                    if (!isSerializationConflict(error) || attempt === MAX_TRANSACTION_RETRIES - 1) throw error;
                }
            }
            res.status(201).json({ success: true, data: { schedule: presentSchedule(schedule) } });
        },

        updateVisitSchedule: async (req, res) => {
            const scheduleId = parsePositiveInteger(req.params.scheduleId, "scheduleId");
            const input = parseUpdateScheduleBody(req.body);
            let schedule;

            for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
                try {
                    schedule = await prismaClient.$transaction(async (tx) => {
                        const existing = await tx.visitSchedule.findFirst({
                            where: ownedScheduleWhere(scheduleId, req.user.id),
                            select: {
                                id: true,
                                customerId: true,
                                propertyId: true,
                                outsideSalesEmployeeId: true,
                                scheduledAt: true,
                                status: true,
                                visit: { select: { id: true } },
                            },
                        });
                        if (!existing) throw new AppError(404, "Visit schedule not found.");
                        if (!ACTIVE_SCHEDULE_STATUSES.includes(existing.status) || existing.visit) {
                            throw new AppError(409, "This visit schedule can no longer be changed.");
                        }
                        if (input.action === "reschedule") {
                            if (existing.scheduledAt.getTime() === input.scheduledAt.getTime()) {
                                throw new AppError(400, "scheduledAt must differ from the current schedule time.");
                            }
                            const duplicate = await tx.visitSchedule.findFirst({
                                where: activeDuplicateScheduleWhere({
                                    customerId: existing.customerId,
                                    propertyId: existing.propertyId,
                                    outsideSalesEmployeeId: existing.outsideSalesEmployeeId,
                                    scheduledAt: input.scheduledAt,
                                    excludeScheduleId: scheduleId,
                                }),
                                select: { id: true },
                            });
                            if (duplicate) throw new AppError(409, "An active matching visit schedule already exists.");
                        }

                        const update = await tx.visitSchedule.updateMany({
                            where: { ...ownedScheduleWhere(scheduleId, req.user.id), status: { in: ACTIVE_SCHEDULE_STATUSES }, visit: null },
                            data: input.action === "cancel"
                                ? { status: "CANCELLED", ...(input.notes === undefined ? {} : { notes: input.notes }) }
                                : { scheduledAt: input.scheduledAt, status: "RESCHEDULED", ...(input.notes === undefined ? {} : { notes: input.notes }) },
                        });
                        if (update.count === 0) throw new AppError(409, "This visit schedule can no longer be changed.");

                        return tx.visitSchedule.findFirst({
                            where: ownedScheduleWhere(scheduleId, req.user.id),
                            select: scheduleSelect,
                        });
                    }, { isolationLevel: "Serializable" });
                    break;
                } catch (error) {
                    if (!isSerializationConflict(error) || attempt === MAX_TRANSACTION_RETRIES - 1) throw error;
                }
            }
            res.status(200).json({ success: true, data: { schedule: presentSchedule(schedule) } });
        },

        dashboard: async (req, res) => {
            const customerWhere = assignedCustomerWhere(undefined, req.user.id);
            const [assignedCustomers, ...counts] = await prismaClient.$transaction([
                prismaClient.customer.count({ where: customerWhere }),
                ...INTEREST_STATUS_VALUES.map((interestStatus) => prismaClient.customer.count({
                    where: { ...customerWhere, interestStatus },
                })),
                prismaClient.callLog.count({ where: { employeeId: req.user.id } }),
                ...CALL_OUTCOME_VALUES.map((outcome) => prismaClient.callLog.count({
                    where: { employeeId: req.user.id, outcome },
                })),
                prismaClient.visitSchedule.count({ where: { insideSalesEmployeeId: req.user.id } }),
                ...VISIT_SCHEDULE_STATUS_VALUES.map((status) => prismaClient.visitSchedule.count({
                    where: { insideSalesEmployeeId: req.user.id, status },
                })),
            ]);
            const interestStatusCounts = counts.splice(0, INTEREST_STATUS_VALUES.length);
            const totalCalls = counts.shift();
            const callOutcomeCounts = counts.splice(0, CALL_OUTCOME_VALUES.length);
            const totalSchedules = counts.shift();
            const scheduleStatusCounts = counts.splice(0, VISIT_SCHEDULE_STATUS_VALUES.length);

            res.status(200).json({
                success: true,
                data: {
                    assignedCustomers,
                    interestStatuses: countsByEnum(INTEREST_STATUS_VALUES, interestStatusCounts),
                    callActivity: { total: totalCalls, byOutcome: countsByEnum(CALL_OUTCOME_VALUES, callOutcomeCounts) },
                    visitSchedules: { total: totalSchedules, byStatus: countsByEnum(VISIT_SCHEDULE_STATUS_VALUES, scheduleStatusCounts) },
                },
            });
        },

        profile: async (req, res) => {
            const user = await prismaClient.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    profileImageUrl: true,
                    isActive: true,
                    role: { select: { name: true } },
                },
            });
            if (!user || !user.isActive || user.role.name !== "INSIDE_SALES") {
                throw new AppError(404, "Profile not found.");
            }
            res.status(200).json({ success: true, data: { profile: safeProfile(user) } });
        },
    };
}

export { callLogSelect, customerSelect, propertySelect, scheduleSelect };
