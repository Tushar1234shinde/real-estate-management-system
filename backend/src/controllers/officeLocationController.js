import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_RADIUS_METERS = 100000;
const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 500;

const officeLocationSelect = {
    id: true,
    officeName: true,
    address: true,
    latitude: true,
    longitude: true,
    allowedRadiusMeters: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};

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

function parseOfficeName(value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, "officeName is required.");
    }
    const trimmed = value.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
        throw new AppError(400, `officeName must be no more than ${MAX_NAME_LENGTH} characters.`);
    }
    return trimmed;
}

function parseAddress(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || !value.trim()) {
        throw new AppError(400, "address must be a non-empty string.");
    }
    const trimmed = value.trim();
    if (trimmed.length > MAX_ADDRESS_LENGTH) {
        throw new AppError(400, `address must be no more than ${MAX_ADDRESS_LENGTH} characters.`);
    }
    return trimmed;
}

function parseCoordinate(value, name, minimum, maximum) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new AppError(400, `${name} must be a finite number between ${minimum} and ${maximum}.`);
    }
    return value;
}

function parseRadius(value) {
    if (value === undefined || value === null) return 200;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > MAX_RADIUS_METERS) {
        throw new AppError(400, `allowedRadiusMeters must be a positive integer between 1 and ${MAX_RADIUS_METERS}.`);
    }
    return value;
}

export function createOfficeLocationController({ prismaClient = prisma } = {}) {
    return {
        listOfficeLocations: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page", MAX_PAGE_SIZE);
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;

            const [offices, total] = await prismaClient.$transaction([
                prismaClient.officeLocation.findMany({
                    select: officeLocationSelect,
                    orderBy: [{ officeName: "asc" }, { id: "asc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.officeLocation.count(),
            ]);

            res.status(200).json({
                success: true,
                data: {
                    officeLocations: offices,
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
                },
            });
        },

        createOfficeLocation: async (req, res) => {
            requireObjectBody(req.body);
            rejectUnexpectedFields(req.body, new Set([
                "officeName", "address", "latitude", "longitude", "allowedRadiusMeters", "isActive",
            ]));

            const officeName = parseOfficeName(req.body.officeName);
            const address = parseAddress(req.body.address);
            const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
            const longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);
            const allowedRadiusMeters = parseRadius(req.body.allowedRadiusMeters);

            const office = await prismaClient.officeLocation.create({
                data: {
                    officeName,
                    address,
                    latitude,
                    longitude,
                    allowedRadiusMeters,
                    isActive: req.body.isActive !== false,
                },
                select: officeLocationSelect,
            });
            res.status(201).json({ success: true, data: { officeLocation: office } });
        },

        updateOfficeLocation: async (req, res) => {
            const officeLocationId = parsePositiveInteger(req.params.id, undefined, "id");
            requireObjectBody(req.body);
            rejectUnexpectedFields(req.body, new Set([
                "officeName", "address", "latitude", "longitude", "allowedRadiusMeters", "isActive",
            ]));

            const data = {};
            if (req.body.officeName !== undefined) data.officeName = parseOfficeName(req.body.officeName);
            if (req.body.address !== undefined) data.address = parseAddress(req.body.address);
            if (req.body.latitude !== undefined) data.latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
            if (req.body.longitude !== undefined) data.longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);
            if (req.body.allowedRadiusMeters !== undefined) data.allowedRadiusMeters = parseRadius(req.body.allowedRadiusMeters);
            if (req.body.isActive !== undefined) {
                if (typeof req.body.isActive !== "boolean") throw new AppError(400, "isActive must be a boolean.");
                data.isActive = req.body.isActive;
            }

            if (Object.keys(data).length === 0) {
                throw new AppError(400, "At least one field must be provided for update.");
            }

            try {
                const office = await prismaClient.officeLocation.update({
                    where: { id: officeLocationId },
                    data,
                    select: officeLocationSelect,
                });
                res.status(200).json({ success: true, data: { officeLocation: office } });
            } catch (error) {
                if (error.code === "P2025") throw new AppError(404, "Office location not found.");
                throw error;
            }
        },

        toggleOfficeLocationStatus: async (req, res) => {
            const officeLocationId = parsePositiveInteger(req.params.id, undefined, "id");

            const existing = await prismaClient.officeLocation.findUnique({
                where: { id: officeLocationId },
                select: { id: true, isActive: true },
            });
            if (!existing) throw new AppError(404, "Office location not found.");

            const office = await prismaClient.officeLocation.update({
                where: { id: officeLocationId },
                data: { isActive: !existing.isActive },
                select: officeLocationSelect,
            });
            res.status(200).json({ success: true, data: { officeLocation: office } });
        },
    };
}
