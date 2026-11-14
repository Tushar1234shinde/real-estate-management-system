import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const OUTCOMES = new Set(["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"]);
const OUTCOME_VALUES = [...OUTCOMES];
const MAX_NOTES = 2_000;
const MAX_PAGE_SIZE = 100;

const callSelect = {
    id: true, customerId: true, employeeId: true, propertyId: true, outcome: true, notes: true, calledAt: true,
    customer: { select: { id: true, fullName: true, phone: true } },
    employee: { select: { id: true, fullName: true, email: true, role: { select: { name: true } } } },
    property: { select: { id: true, title: true } },
};
function object(body) { if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Request body must be a JSON object."); }
function id(value, name) { if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new AppError(400, `${name} must be a positive integer.`); return Number(value); }
function queryId(value, name) { return value === undefined ? undefined : id(value, name); }
function page(value, fallback, name, max) { if (value === undefined) return fallback; const result = id(value, name); if (max && result > max) throw new AppError(400, `${name} must be between 1 and ${max}.`); return result; }
function bodyData(body) {
    object(body);
    if (Object.keys(body).some((key) => !new Set(["outcome", "notes", "propertyId"]).has(key))) throw new AppError(400, "Request body contains unsupported fields.");
    if (typeof body.outcome !== "string" || !OUTCOMES.has(body.outcome)) throw new AppError(400, "outcome must be a valid call outcome.");
    if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.trim().length > MAX_NOTES)) throw new AppError(400, `notes must be a string no longer than ${MAX_NOTES} characters.`);
    if (body.propertyId !== undefined && (!Number.isSafeInteger(body.propertyId) || body.propertyId < 1)) throw new AppError(400, "propertyId must be a positive integer.");
    return { outcome: body.outcome, notes: body.notes?.trim() || null, ...(body.propertyId === undefined ? {} : { propertyId: body.propertyId }) };
}
function date(value, name) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, `${name} must use YYYY-MM-DD.`);
    const start = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) throw new AppError(400, `${name} must be a valid calendar date.`);
    return start;
}
function dateWhere(query) {
    if (query.date !== undefined && (query.from !== undefined || query.to !== undefined)) throw new AppError(400, "date cannot be combined with from or to.");
    if (query.date !== undefined) { const start = date(query.date, "date"); return { calledAt: { gte: start, lt: new Date(start.getTime() + 86_400_000) } }; }
    const from = query.from === undefined ? undefined : date(query.from, "from");
    const to = query.to === undefined ? undefined : new Date(date(query.to, "to").getTime() + 86_400_000);
    if (from && to && from >= to) throw new AppError(400, "from must be on or before to.");
    return from || to ? { calledAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {};
}
function assignedCustomerWhere(customerId, user) {
    return user.role === "INSIDE_SALES"
        ? { id: customerId, assignment: { is: { insideSalesEmployeeId: user.id } } }
        : { id: customerId, visitSchedules: { some: { outsideSalesEmployeeId: user.id } } };
}

export function createCallLogController({ prismaClient = prisma } = {}) {
    return {
        listOwnCustomerLogs: async (req, res) => {
            const customerId = id(req.params.customerId, "customerId");
            const customer = await prismaClient.customer.findFirst({ where: assignedCustomerWhere(customerId, req.user), select: { id: true } });
            if (!customer) throw new AppError(404, "Customer not found.");
            const callLogs = await prismaClient.callLog.findMany({ where: { customerId, employeeId: req.user.id }, select: callSelect, orderBy: [{ calledAt: "desc" }, { id: "desc" }] });
            res.status(200).json({ success: true, data: { callLogs } });
        },
        createOwnCustomerLog: async (req, res) => {
            const customerId = id(req.params.customerId, "customerId");
            const data = bodyData(req.body);
            const customer = await prismaClient.customer.findFirst({ where: assignedCustomerWhere(customerId, req.user), select: { id: true } });
            if (!customer) throw new AppError(404, "Customer not found.");
            if (data.propertyId) {
                const property = await prismaClient.property.findUnique({ where: { id: data.propertyId }, select: { id: true } });
                if (!property) throw new AppError(404, "Property not found.");
            }
            const callLog = await prismaClient.callLog.create({ data: { ...data, customerId, employeeId: req.user.id }, select: callSelect });
            res.status(201).json({ success: true, data: { callLog } });
        },
        listOrganizationLogs: async (req, res) => {
            const currentPage = page(req.query.page, 1, "page");
            const pageSize = page(req.query.pageSize, 20, "pageSize", MAX_PAGE_SIZE);
            const employeeId = queryId(req.query.employeeId, "employeeId");
            const customerId = queryId(req.query.customerId, "customerId");
            const outcome = req.query.outcome;
            if (outcome !== undefined && !OUTCOMES.has(outcome)) throw new AppError(400, "outcome must be a valid call outcome.");
            const role = req.query.role;
            if (role !== undefined && !["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"].includes(role)) throw new AppError(400, "role must be a supported role.");
            const where = { ...(employeeId ? { employeeId } : {}), ...(customerId ? { customerId } : {}), ...(outcome ? { outcome } : {}), ...(role ? { employee: { role: { name: role } } } : {}), ...dateWhere(req.query) };
            const [callLogs, total] = await prismaClient.$transaction([
                prismaClient.callLog.findMany({ where, select: callSelect, orderBy: [{ calledAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * pageSize, take: pageSize }),
                prismaClient.callLog.count({ where }),
            ]);
            res.status(200).json({ success: true, data: { callLogs, pagination: { page: currentPage, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
        },
        statistics: async (req, res) => {
            const where = dateWhere(req.query);
            const [total, outcomes, employees] = await prismaClient.$transaction([
                prismaClient.callLog.count({ where }),
                prismaClient.callLog.groupBy({ by: ["outcome"], where, _count: { _all: true } }),
                prismaClient.callLog.groupBy({ by: ["employeeId"], where, _count: { _all: true }, orderBy: { _count: { employeeId: "desc" } }, take: 10 }),
            ]);
            const byOutcome = Object.fromEntries(OUTCOME_VALUES.map((value) => [value, 0]));
            outcomes.forEach((row) => { byOutcome[row.outcome] = row._count._all; });
            res.status(200).json({ success: true, data: { total, byOutcome, topEmployees: employees.map((row) => ({ employeeId: row.employeeId, callCount: row._count._all })) } });
        },
    };
}
