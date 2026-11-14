import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_FULL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_PROFILE_IMAGE_URL_LENGTH = 2_048;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;
const ROLES = new Set(["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]);

const employeeSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    profileImageUrl: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    role: { select: { id: true, name: true, description: true } },
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

function parseEmployeeId(value) {
    return parsePositiveInteger(value, undefined, "employeeId");
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

function parseName(value) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > MAX_FULL_NAME_LENGTH) {
        throw new AppError(400, `fullName must be between 1 and ${MAX_FULL_NAME_LENGTH} characters.`);
    }
    return value.trim();
}

function parseEmail(value) {
    if (typeof value !== "string" || value.trim().length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(value.trim())) {
        throw new AppError(400, "email must be a valid email address.");
    }
    return value.trim().toLowerCase();
}

function parsePhone(value) {
    if (value === null) return null;
    if (typeof value !== "string" || !PHONE_PATTERN.test(value.trim())) {
        throw new AppError(400, "phone must be a valid international phone number.");
    }
    return value.trim();
}

function parseProfileImageUrl(value) {
    if (value === null) return null;
    if (typeof value !== "string" || value.trim().length > MAX_PROFILE_IMAGE_URL_LENGTH) {
        throw new AppError(400, `profileImageUrl must be a URL no longer than ${MAX_PROFILE_IMAGE_URL_LENGTH} characters.`);
    }
    try {
        const url = new URL(value.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Unsupported protocol");
    } catch {
        throw new AppError(400, "profileImageUrl must be a valid HTTP(S) URL.");
    }
    return value.trim();
}

function parsePassword(value) {
    if (typeof value !== "string" || value.length < 8 || value.length > MAX_PASSWORD_LENGTH) {
        throw new AppError(400, `password must be between 8 and ${MAX_PASSWORD_LENGTH} characters.`);
    }
    return value;
}

function parseRole(value) {
    if (typeof value !== "string" || !ROLES.has(value)) {
        throw new AppError(400, "role must be a supported role.");
    }
    return value;
}

function parseBooleanFilter(value) {
    if (value === undefined) return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new AppError(400, "isActive must be true or false.");
}

function parseCreateBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set(["fullName", "email", "password", "role", "phone", "profileImageUrl"]));
    return {
        fullName: parseName(body.fullName),
        email: parseEmail(body.email),
        password: parsePassword(body.password),
        role: parseRole(body.role),
        phone: body.phone === undefined ? null : parsePhone(body.phone),
        profileImageUrl: body.profileImageUrl === undefined ? null : parseProfileImageUrl(body.profileImageUrl),
    };
}

function parseUpdateBody(body, actorRole) {
    requireObjectBody(body);
    const executiveForbiddenFields = new Set(["email", "password", "role", "isActive"]);
    if (actorRole === "EXECUTIVE" && Object.keys(body).some((field) => executiveForbiddenFields.has(field))) {
        throw new AppError(403, "Executives may update only employee name, phone, and profile image.");
    }

    const allowed = actorRole === "EXECUTIVE"
        ? new Set(["fullName", "phone", "profileImageUrl"])
        : new Set(["fullName", "email", "password", "role", "phone", "profileImageUrl"]);
    rejectUnexpectedFields(body, allowed);
    if (Object.keys(body).length === 0) throw new AppError(400, "Request body must include at least one editable field.");

    const data = {};
    if (body.fullName !== undefined) data.fullName = parseName(body.fullName);
    if (body.email !== undefined) data.email = parseEmail(body.email);
    if (body.password !== undefined) data.password = parsePassword(body.password);
    if (body.role !== undefined) data.role = parseRole(body.role);
    if (body.phone !== undefined) data.phone = parsePhone(body.phone);
    if (body.profileImageUrl !== undefined) data.profileImageUrl = parseProfileImageUrl(body.profileImageUrl);
    return data;
}

function isUniqueConstraintError(error) {
    return error?.code === "P2002";
}

function isTransactionConflict(error) {
    const codes = [error?.code, error?.cause?.code, error?.cause?.originalCode];
    return codes.some((code) => ["P2034", "40001", "40P01"].includes(code));
}

async function roleIdFor(prismaClient, roleName) {
    const role = await prismaClient.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) throw new AppError(409, "Configured role is unavailable.");
    return role.id;
}

export function createAdminEmployeeController({ prismaClient = prisma } = {}) {
    return {
        listEmployees: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const role = req.query.role === undefined ? undefined : parseRole(req.query.role);
            const isActive = parseBooleanFilter(req.query.isActive);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");

            const where = {
                ...(role === undefined ? {} : { role: { name: role } }),
                ...(isActive === undefined ? {} : { isActive }),
            };
            const [employees, total] = await prismaClient.$transaction([
                prismaClient.user.findMany({ where, select: employeeSelect, orderBy: [{ fullName: "asc" }, { id: "asc" }], skip, take: pageSize }),
                prismaClient.user.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: { employees, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        createEmployee: async (req, res) => {
            const input = parseCreateBody(req.body);
            if (req.user.role === "EXECUTIVE" && !["INSIDE_SALES", "OUTSIDE_SALES"].includes(input.role)) {
                throw new AppError(403, "Executives may create only INSIDE_SALES and OUTSIDE_SALES employees.");
            }
            const roleId = await roleIdFor(prismaClient, input.role);
            const passwordHash = await bcrypt.hash(input.password, 10);
            try {
                const employee = await prismaClient.user.create({
                    data: {
                        fullName: input.fullName,
                        email: input.email,
                        passwordHash,
                        roleId,
                        phone: input.phone,
                        profileImageUrl: input.profileImageUrl,
                    },
                    select: employeeSelect,
                });
                res.status(201).json({ success: true, data: { employee } });
            } catch (error) {
                if (isUniqueConstraintError(error)) throw new AppError(409, "An employee with that email or phone already exists.");
                throw error;
            }
        },

        getEmployee: async (req, res) => {
            const employeeId = parseEmployeeId(req.params.employeeId);
            const employee = await prismaClient.user.findUnique({ where: { id: employeeId }, select: employeeSelect });
            if (!employee) throw new AppError(404, "Employee not found.");
            res.status(200).json({ success: true, data: { employee } });
        },

        updateEmployee: async (req, res) => {
            const employeeId = parseEmployeeId(req.params.employeeId);
            const input = parseUpdateBody(req.body, req.user.role);
            const data = {};
            if (input.fullName !== undefined) data.fullName = input.fullName;
            if (input.email !== undefined) data.email = input.email;
            if (input.phone !== undefined) data.phone = input.phone;
            if (input.profileImageUrl !== undefined) data.profileImageUrl = input.profileImageUrl;
            if (input.password !== undefined) data.passwordHash = await bcrypt.hash(input.password, 10);
            if (input.role !== undefined) data.roleId = await roleIdFor(prismaClient, input.role);

            try {
                const employee = await prismaClient.$transaction(async (tx) => {
                    const existing = await tx.user.findUnique({
                        where: { id: employeeId },
                        select: { id: true, role: { select: { name: true } } },
                    });
                    if (!existing) throw new AppError(404, "Employee not found.");

                    if (existing.role.name === "INSIDE_SALES"
                        && input.role !== undefined
                        && input.role !== "INSIDE_SALES") {
                        const assignmentCount = await tx.customerAssignment.count({
                            where: { insideSalesEmployeeId: employeeId },
                        });
                        if (assignmentCount > 0) {
                            throw new AppError(409, "Employees with permanent customer assignments cannot be changed from INSIDE_SALES to another role.");
                        }
                    }

                    return tx.user.update({ where: { id: employeeId }, data, select: employeeSelect });
                }, { isolationLevel: "Serializable" });
                res.status(200).json({ success: true, data: { employee } });
            } catch (error) {
                if (isUniqueConstraintError(error)) throw new AppError(409, "An employee with that email or phone already exists.");
                if (isTransactionConflict(error)) throw new AppError(409, "Employee assignment state changed; retry the update.");
                throw error;
            }
        },

        updateEmployeeStatus: async (req, res) => {
            if (req.user.role !== "ADMIN") {
                throw new AppError(403, "Only administrators may change employee status.");
            }
            const employeeId = parseEmployeeId(req.params.employeeId);
            requireObjectBody(req.body);
            rejectUnexpectedFields(req.body, new Set(["isActive"]));
            if (typeof req.body.isActive !== "boolean") throw new AppError(400, "isActive must be a boolean.");
            if (!req.body.isActive && employeeId === req.user.id) {
                throw new AppError(409, "You cannot deactivate your own account.");
            }

            try {
                const employee = await prismaClient.$transaction(async (tx) => {
                    const existing = await tx.user.findUnique({
                        where: { id: employeeId },
                        select: { id: true, isActive: true, role: { select: { name: true } } },
                    });
                    if (!existing) throw new AppError(404, "Employee not found.");

                    if (existing.role.name === "INSIDE_SALES" && !req.body.isActive) {
                        const assignmentCount = await tx.customerAssignment.count({
                            where: { insideSalesEmployeeId: employeeId },
                        });
                        if (assignmentCount > 0) {
                            throw new AppError(409, "Employees with permanent customer assignments cannot be deactivated.");
                        }
                    }

                    return tx.user.update({
                        where: { id: employeeId },
                        data: { isActive: req.body.isActive },
                        select: employeeSelect,
                    });
                }, { isolationLevel: "Serializable" });
                res.status(200).json({ success: true, data: { employee } });
            } catch (error) {
                if (isTransactionConflict(error)) throw new AppError(409, "Employee assignment state changed; retry the status update.");
                throw error;
            }
        },
    };
}

export { employeeSelect };
