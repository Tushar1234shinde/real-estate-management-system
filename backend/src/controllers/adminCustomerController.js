import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_FULL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_ADDRESS_LENGTH = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const CUSTOMER_STATUSES = new Set(["NEW", "ASSIGNED", "CONTACTED", "CONVERTED", "CLOSED"]);
const INTEREST_STATUSES = new Set(["PENDING", "INTERESTED", "NOT_INTERESTED"]);

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
    assignment: {
        select: {
            id: true,
            insideSalesEmployeeId: true,
            assignedAt: true,
            status: true,
        },
    },
};

const assignmentSelect = {
    id: true,
    customerId: true,
    insideSalesEmployeeId: true,
    assignedByUserId: true,
    assignedAt: true,
    status: true,
    customer: {
        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            interestStatus: true,
        },
    },
    insideSalesEmployee: {
        select: {
            id: true,
            fullName: true,
            email: true,
        },
    },
    assignedBy: {
        select: {
            id: true,
            fullName: true,
            email: true,
        },
    },
};

const assignmentCustomerSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    address: true,
    status: true,
    interestStatus: true,
};

function parsePositiveInteger(value, fallback, fieldName, maximum) {
    if (value === undefined) return fallback;
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

function parseCustomerId(value) {
    return parsePositiveInteger(value, undefined, "customerId");
}

function parseInsideSalesEmployeeId(value) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new AppError(400, "insideSalesEmployeeId must be a positive integer.");
    }
    return value;
}

function requireObjectBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new AppError(400, "Request body must be a JSON object.");
    }
}

function rejectUnexpectedFields(body, allowed) {
    if (Object.keys(body).some((key) => !allowed.has(key))) {
        throw new AppError(400, "Request body contains unsupported fields.");
    }
}

function parseFullName(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_FULL_NAME_LENGTH) {
        throw new AppError(400, `fullName must be between 1 and ${MAX_FULL_NAME_LENGTH} characters.`);
    }
    return value.trim();
}

function parsePhone(value) {
    if (typeof value !== "string" || !PHONE_PATTERN.test(value.trim())) {
        throw new AppError(400, "phone must be a valid international phone number.");
    }
    return value.trim();
}

function parseEmail(value) {
    if (value === null) return null;
    if (typeof value !== "string" || value.trim().length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(value.trim())) {
        throw new AppError(400, "email must be a valid email address.");
    }
    return value.trim().toLowerCase();
}

function parseAddress(value) {
    if (value === null) return null;
    if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_ADDRESS_LENGTH) {
        throw new AppError(400, `address must be between 1 and ${MAX_ADDRESS_LENGTH} characters.`);
    }
    return value.trim();
}

function parseCustomerStatus(value) {
    if (typeof value !== "string" || !CUSTOMER_STATUSES.has(value)) {
        throw new AppError(400, "status must be a supported customer status.");
    }
    return value;
}

function parseInterestStatus(value) {
    if (typeof value !== "string" || !INTEREST_STATUSES.has(value)) {
        throw new AppError(400, "interestStatus must be PENDING, INTERESTED, or NOT_INTERESTED.");
    }
    return value;
}

function parseCreateBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["fullName", "phone", "email", "address", "status", "interestStatus"]));
    const status = body.status === undefined ? "NEW" : parseCustomerStatus(body.status);
    if (status !== "NEW") {
        throw new AppError(400, "Customers without an assignment must have NEW status.");
    }
    return {
        fullName: parseFullName(body.fullName),
        phone: parsePhone(body.phone),
        email: body.email === undefined ? null : parseEmail(body.email),
        address: body.address === undefined ? null : parseAddress(body.address),
        status,
        interestStatus: body.interestStatus === undefined ? "PENDING" : parseInterestStatus(body.interestStatus),
    };
}

function parseUpdateBody(body) {
    requireObjectBody(body);
    const allowed = new Set(["fullName", "phone", "email", "address", "status", "interestStatus"]);
    rejectUnexpectedFields(body, allowed);
    if (Object.keys(body).length === 0) throw new AppError(400, "Request body must include at least one editable field.");

    const data = {};
    if (body.fullName !== undefined) data.fullName = parseFullName(body.fullName);
    if (body.phone !== undefined) data.phone = parsePhone(body.phone);
    if (body.email !== undefined) data.email = parseEmail(body.email);
    if (body.address !== undefined) data.address = parseAddress(body.address);
    if (body.status !== undefined) data.status = parseCustomerStatus(body.status);
    if (body.interestStatus !== undefined) data.interestStatus = parseInterestStatus(body.interestStatus);
    return data;
}

function parseAssignmentBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["insideSalesEmployeeId"]));
    return { insideSalesEmployeeId: parseInsideSalesEmployeeId(body.insideSalesEmployeeId) };
}

function parseExecutiveAssignmentBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["customerId", "insideSalesEmployeeId"]));
    if (!Number.isSafeInteger(body.customerId) || body.customerId < 1) {
        throw new AppError(400, "customerId must be a positive integer.");
    }
    return {
        customerId: body.customerId,
        insideSalesEmployeeId: parseInsideSalesEmployeeId(body.insideSalesEmployeeId),
    };
}

function isAssignmentConflict(error) {
    const codes = [error?.code, error?.cause?.code, error?.cause?.originalCode];
    return codes.some((code) => ["P2002", "P2034", "40001", "40P01"].includes(code));
}

function mapAssignment(assignment) {
    if (!assignment) return null;
    return {
        id: assignment.id,
        customerId: assignment.customerId,
        insideSalesEmployeeId: assignment.insideSalesEmployeeId,
        assignedByUserId: assignment.assignedByUserId,
        assignedAt: assignment.assignedAt,
        status: assignment.status,
        customer: {
            id: assignment.customer.id,
            fullName: assignment.customer.fullName,
            email: assignment.customer.email,
            phone: assignment.customer.phone,
            address: assignment.customer.address,
            status: assignment.customer.status,
            interestStatus: assignment.customer.interestStatus,
        },
        insideSalesEmployee: {
            id: assignment.insideSalesEmployee.id,
            fullName: assignment.insideSalesEmployee.fullName,
            email: assignment.insideSalesEmployee.email,
        },
        assignedBy: {
            id: assignment.assignedBy.id,
            fullName: assignment.assignedBy.fullName,
            email: assignment.assignedBy.email,
        },
    };
}

async function createCustomerAssignment(prismaClient, req, res, customerId, insideSalesEmployeeId) {
    let assignment;

    try {
        assignment = await prismaClient.$transaction(async (tx) => {
            const customer = await tx.customer.findUnique({
                where: { id: customerId },
                select: { id: true, assignment: { select: { id: true } } },
            });
            if (!customer) throw new AppError(404, "Customer not found.");
            if (customer.assignment) throw new AppError(409, "Customer is already assigned.");

            const employee = await tx.user.findFirst({
                where: { id: insideSalesEmployeeId, isActive: true, role: { name: "INSIDE_SALES" } },
                select: { id: true },
            });
            if (!employee) {
                throw new AppError(400, "insideSalesEmployeeId must identify an active INSIDE_SALES employee.");
            }

            await tx.customer.update({
                where: { id: customerId },
                data: { status: "ASSIGNED" },
                select: { id: true },
            });
            return tx.customerAssignment.create({
                data: {
                    customerId,
                    insideSalesEmployeeId,
                    assignedByUserId: req.user.id,
                },
                select: assignmentSelect,
            });
        }, { isolationLevel: "Serializable" });
    } catch (error) {
        if (isAssignmentConflict(error)) {
            throw new AppError(409, "Customer is already assigned.");
        }
        throw error;
    }

    res.status(201).json({ success: true, data: { assignment: mapAssignment(assignment) } });
}

export function createAdminCustomerController({ prismaClient = prisma } = {}) {
    return {
        listCustomers: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const status = req.query.status === undefined ? undefined : parseCustomerStatus(req.query.status);
            const interestStatus = req.query.interestStatus === undefined ? undefined : parseInterestStatus(req.query.interestStatus);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");

            const where = {
                ...(status === undefined ? {} : { status }),
                ...(interestStatus === undefined ? {} : { interestStatus }),
            };
            const [customers, total] = await prismaClient.$transaction([
                prismaClient.customer.findMany({ where, select: customerSelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take: pageSize }),
                prismaClient.customer.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: { customers, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        createCustomer: async (req, res) => {
            const data = parseCreateBody(req.body);
            const customer = await prismaClient.customer.create({ data, select: customerSelect });
            res.status(201).json({ success: true, data: { customer } });
        },

        getCustomer: async (req, res) => {
            const customerId = parseCustomerId(req.params.customerId);
            const customer = await prismaClient.customer.findUnique({ where: { id: customerId }, select: customerSelect });
            if (!customer) throw new AppError(404, "Customer not found.");
            res.status(200).json({ success: true, data: { customer } });
        },

        updateCustomer: async (req, res) => {
            const customerId = parseCustomerId(req.params.customerId);
            const data = parseUpdateBody(req.body);
            let customer;
            if (data.status !== undefined) {
                try {
                    customer = await prismaClient.$transaction(async (tx) => {
                        const existing = await tx.customer.findUnique({
                            where: { id: customerId },
                            select: { id: true, assignment: { select: { id: true } } },
                        });
                        if (!existing) throw new AppError(404, "Customer not found.");
                        if (data.status === "NEW" && existing.assignment) {
                            throw new AppError(409, "An assigned customer cannot be returned to NEW status.");
                        }
                        if (data.status !== "NEW" && !existing.assignment) {
                            throw new AppError(409, "Customer must have an assignment before leaving NEW status.");
                        }
                        return tx.customer.update({ where: { id: customerId }, data, select: customerSelect });
                    }, { isolationLevel: "Serializable" });
                } catch (error) {
                    if (error?.code === "P2034") {
                        throw new AppError(409, "Customer assignment changed; retry the status update.");
                    }
                    throw error;
                }
            } else {
                const existing = await prismaClient.customer.findUnique({ where: { id: customerId }, select: { id: true } });
                if (!existing) throw new AppError(404, "Customer not found.");
                customer = await prismaClient.customer.update({ where: { id: customerId }, data, select: customerSelect });
            }
            res.status(200).json({ success: true, data: { customer } });
        },

        getCustomerAssignment: async (req, res) => {
            const customerId = parseCustomerId(req.params.customerId);
            const customer = await prismaClient.customer.findUnique({
                where: { id: customerId },
                select: {
                    ...assignmentCustomerSelect,
                    assignment: { select: assignmentSelect },
                },
            });
            if (!customer) throw new AppError(404, "Customer not found.");
            res.status(200).json({ success: true, data: { assignment: mapAssignment(customer.assignment) } });
        },

        assignCustomer: async (req, res) => {
            const customerId = parseCustomerId(req.params.customerId);
            const { insideSalesEmployeeId } = parseAssignmentBody(req.body);
            await createCustomerAssignment(prismaClient, req, res, customerId, insideSalesEmployeeId);
        },

        assignCustomerFromBody: async (req, res) => {
            const { customerId, insideSalesEmployeeId } = parseExecutiveAssignmentBody(req.body);
            await createCustomerAssignment(prismaClient, req, res, customerId, insideSalesEmployeeId);
        },
    };
}

export { customerSelect };
