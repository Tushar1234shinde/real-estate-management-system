import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_LOCATION_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 5_000;
const MAX_PRICE_CENTS = 999_999_999_999n;
const PROPERTY_STATUSES = new Set(["AVAILABLE", "BOOKED", "SOLD", "INACTIVE"]);

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
    createdAt: true,
    updatedAt: true,
};

function mapProperty(property) {
    return {
        id: property.id,
        title: property.title,
        description: property.description,
        location: property.location,
        latitude: property.latitude,
        longitude: property.longitude,
        verificationRadiusMeters: property.verificationRadiusMeters,
        price: String(property.price),
        status: property.status,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
    };
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

function parsePropertyId(value) {
    return parsePositiveInteger(value, undefined, "propertyId");
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

function parseRequiredText(value, fieldName, maximum) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
        throw new AppError(400, `${fieldName} must be between 1 and ${maximum} characters.`);
    }
    return value.trim();
}

function parseNullableText(value, fieldName, maximum) {
    if (value === null) return null;
    return parseRequiredText(value, fieldName, maximum);
}

function parsePrice(value) {
    if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "number" && !Number.isFinite(value))) {
        throw new AppError(400, "price must be a positive monetary amount with at most two decimal places.");
    }
    const normalized = String(value);
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
    if (!match) throw new AppError(400, "price must be a positive monetary amount with at most two decimal places.");
    const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
    if (cents <= 0n || cents > MAX_PRICE_CENTS) {
        throw new AppError(400, "price is outside the supported range.");
    }
    return normalized;
}

function parseStatus(value) {
    if (typeof value !== "string" || !PROPERTY_STATUSES.has(value)) {
        throw new AppError(400, "status must be a supported property status.");
    }
    return value;
}

// The database enforces a fixed verification radius of 200 metres
// (CHECK constraint properties_verificationRadiusMeters_fixed_check).
// Accepting any other value here would surface as an uncaught 500, so
// require exactly 200 when a radius is supplied and report it clearly.
function parseRadius(value) {
    if (!Number.isSafeInteger(value) || value !== 200) {
        throw new AppError(400, "verificationRadiusMeters must be 200 metres.");
    }
    return value;
}

function parseCoordinates(body) {
    const hasLatitude = body.latitude !== undefined;
    const hasLongitude = body.longitude !== undefined;
    if (!hasLatitude && !hasLongitude) return undefined;
    if (!hasLatitude || !hasLongitude) {
        throw new AppError(400, "latitude and longitude must be provided together.");
    }
    if (body.latitude === null && body.longitude === null) return { latitude: null, longitude: null };
    if (!Number.isFinite(body.latitude) || !Number.isFinite(body.longitude)) {
        throw new AppError(400, "latitude and longitude must be finite numbers.");
    }
    if (body.latitude < -90 || body.latitude > 90) throw new AppError(400, "latitude must be between -90 and 90.");
    if (body.longitude < -180 || body.longitude > 180) throw new AppError(400, "longitude must be between -180 and 180.");
    return { latitude: body.latitude, longitude: body.longitude };
}

function parseCreateBody(body) {
    requireObjectBody(body);
    rejectUnexpectedFields(body, new Set([
        "title", "description", "location", "price", "status", "latitude", "longitude", "verificationRadiusMeters",
    ]));
    const coordinates = parseCoordinates(body);
    const data = {
        title: parseRequiredText(body.title, "title", MAX_TITLE_LENGTH),
        location: parseRequiredText(body.location, "location", MAX_LOCATION_LENGTH),
        price: parsePrice(body.price),
        ...(body.description === undefined ? {} : { description: parseNullableText(body.description, "description", MAX_DESCRIPTION_LENGTH) }),
        ...(body.status === undefined ? {} : { status: parseStatus(body.status) }),
        ...(body.verificationRadiusMeters === undefined ? {} : { verificationRadiusMeters: parseRadius(body.verificationRadiusMeters) }),
    };
    if (coordinates !== undefined) Object.assign(data, coordinates);
    return data;
}

function parseUpdateBody(body) {
    requireObjectBody(body);
    const allowed = new Set(["title", "description", "location", "price", "status", "latitude", "longitude", "verificationRadiusMeters"]);
    rejectUnexpectedFields(body, allowed);
    if (Object.keys(body).length === 0) throw new AppError(400, "Request body must include at least one editable field.");
    const coordinates = parseCoordinates(body);
    const data = {};
    if (body.title !== undefined) data.title = parseRequiredText(body.title, "title", MAX_TITLE_LENGTH);
    if (body.description !== undefined) data.description = parseNullableText(body.description, "description", MAX_DESCRIPTION_LENGTH);
    if (body.location !== undefined) data.location = parseRequiredText(body.location, "location", MAX_LOCATION_LENGTH);
    if (body.price !== undefined) data.price = parsePrice(body.price);
    if (body.status !== undefined) data.status = parseStatus(body.status);
    if (body.verificationRadiusMeters !== undefined) data.verificationRadiusMeters = parseRadius(body.verificationRadiusMeters);
    if (coordinates !== undefined) Object.assign(data, coordinates);
    return data;
}

export function createAdminPropertyController({ prismaClient = prisma } = {}) {
    return {
        listProperties: async (req, res) => {
            const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const status = req.query.status === undefined ? undefined : parseStatus(req.query.status);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");
            const where = status === undefined ? {} : { status };
            const [properties, total] = await prismaClient.$transaction([
                prismaClient.property.findMany({ where, select: propertySelect, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip, take: pageSize }),
                prismaClient.property.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: { properties: properties.map(mapProperty), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } },
            });
        },

        createProperty: async (req, res) => {
            const data = parseCreateBody(req.body);
            const property = await prismaClient.property.create({ data, select: propertySelect });
            res.status(201).json({ success: true, data: { property: mapProperty(property) } });
        },

        getProperty: async (req, res) => {
            const propertyId = parsePropertyId(req.params.propertyId);
            const property = await prismaClient.property.findUnique({ where: { id: propertyId }, select: propertySelect });
            if (!property) throw new AppError(404, "Property not found.");
            res.status(200).json({ success: true, data: { property: mapProperty(property) } });
        },

        updateProperty: async (req, res) => {
            const propertyId = parsePropertyId(req.params.propertyId);
            const data = parseUpdateBody(req.body);
            const existing = await prismaClient.property.findUnique({ where: { id: propertyId }, select: { id: true } });
            if (!existing) throw new AppError(404, "Property not found.");
            const property = await prismaClient.property.update({ where: { id: propertyId }, data, select: propertySelect });
            res.status(200).json({ success: true, data: { property: mapProperty(property) } });
        },
    };
}

export { propertySelect };
