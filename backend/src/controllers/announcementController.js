import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH"]);
const EMPLOYEE_ROLES = new Set(["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 10_000;
const MAX_CATEGORY_LENGTH = 80;

const creatorSelect = { id: true, fullName: true, email: true, role: { select: { name: true } } };
const announcementSelect = (userId) => ({
    id: true, title: true, content: true, category: true, priority: true, isPublished: true,
    expiresAt: true, targetRoles: true, createdAt: true, updatedAt: true,
    createdBy: { select: creatorSelect },
    ...(userId ? { reads: { where: { userId }, select: { id: true, readAt: true } } } : {}),
});

function requireObject(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Request body must be a JSON object.");
}
function rejectUnexpected(body, allowed) {
    if (Object.keys(body).some((key) => !allowed.has(key))) throw new AppError(400, "Request body contains unsupported fields.");
}
function positiveId(value, name) {
    if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw new AppError(400, `${name} must be a positive integer.`);
    return Number(value);
}
function pageValue(value, fallback, name, max) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value)) || (max && Number(value) > max)) throw new AppError(400, `${name} must be a positive integer.`);
    return Number(value);
}
function text(value, name, maximum) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new AppError(400, `${name} must be between 1 and ${maximum} characters.`);
    return value.trim();
}
function priority(value) {
    if (typeof value !== "string" || !PRIORITIES.has(value)) throw new AppError(400, "priority must be LOW, NORMAL, or HIGH.");
    return value;
}
function roles(value) {
    if (!Array.isArray(value) || value.some((role) => typeof role !== "string" || !EMPLOYEE_ROLES.has(role)) || new Set(value).size !== value.length) {
        throw new AppError(400, "targetRoles must be an array of unique supported roles.");
    }
    return value;
}
function expiry(value, now) {
    if (value === null) return null;
    if (typeof value !== "string") throw new AppError(400, "expiresAt must be an ISO-8601 timestamp or null.");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new AppError(400, "expiresAt must be a valid ISO-8601 timestamp.");
    if (parsed <= now) throw new AppError(400, "expiresAt must be in the future.");
    return parsed;
}
function published(value) {
    if (typeof value !== "boolean") throw new AppError(400, "isPublished must be a boolean.");
    return value;
}
function visibilityWhere(role, now) {
    return {
        isPublished: true,
        AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            { OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: role } }] },
        ],
    };
}
function mapAnnouncement(item) {
    const reads = item.reads;
    const { reads: ignored, ...announcement } = item;
    return reads === undefined ? announcement : { ...announcement, isRead: reads.length > 0, readAt: reads[0]?.readAt ?? null };
}
function uniqueViolation(error) { return error?.code === "P2002" || error?.code === "23505"; }

function createPayload(body, now) {
    requireObject(body);
    rejectUnexpected(body, new Set(["title", "content", "category", "priority", "isPublished", "expiresAt", "targetRoles"]));
    return {
        title: text(body.title, "title", MAX_TITLE_LENGTH),
        content: text(body.content, "content", MAX_CONTENT_LENGTH),
        category: text(body.category, "category", MAX_CATEGORY_LENGTH),
        priority: body.priority === undefined ? "NORMAL" : priority(body.priority),
        isPublished: body.isPublished === undefined ? false : published(body.isPublished),
        expiresAt: body.expiresAt === undefined ? null : expiry(body.expiresAt, now),
        targetRoles: body.targetRoles === undefined ? [] : roles(body.targetRoles),
    };
}
function updatePayload(body, now) {
    requireObject(body);
    rejectUnexpected(body, new Set(["title", "content", "category", "priority", "isPublished", "expiresAt", "targetRoles"]));
    if (!Object.keys(body).length) throw new AppError(400, "Request body must include at least one editable field.");
    const data = {};
    if (body.title !== undefined) data.title = text(body.title, "title", MAX_TITLE_LENGTH);
    if (body.content !== undefined) data.content = text(body.content, "content", MAX_CONTENT_LENGTH);
    if (body.category !== undefined) data.category = text(body.category, "category", MAX_CATEGORY_LENGTH);
    if (body.priority !== undefined) data.priority = priority(body.priority);
    if (body.isPublished !== undefined) data.isPublished = published(body.isPublished);
    if (body.expiresAt !== undefined) data.expiresAt = expiry(body.expiresAt, now);
    if (body.targetRoles !== undefined) data.targetRoles = roles(body.targetRoles);
    return data;
}

export function createAnnouncementController({ prismaClient = prisma, now = () => new Date() } = {}) {
    return {
        create: async (req, res) => {
            const announcement = await prismaClient.announcement.create({ data: { ...createPayload(req.body, now()), createdById: req.user.id }, select: announcementSelect(req.user.id) });
            res.status(201).json({ success: true, data: { announcement: mapAnnouncement(announcement) } });
        },
        list: async (req, res) => {
            const page = pageValue(req.query.page, 1, "page");
            const pageSize = pageValue(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const managing = req.user.role === "ADMIN" || req.user.role === "EXECUTIVE";
            const where = managing ? {} : visibilityWhere(req.user.role, now());
            const [announcements, total] = await prismaClient.$transaction([
                prismaClient.announcement.findMany({ where, select: announcementSelect(req.user.id), orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
                prismaClient.announcement.count({ where }),
            ]);
            res.status(200).json({ success: true, data: { announcements: announcements.map(mapAnnouncement), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
        },
        get: async (req, res) => {
            const id = positiveId(req.params.announcementId, "announcementId");
            const managing = req.user.role === "ADMIN" || req.user.role === "EXECUTIVE";
            const announcement = await prismaClient.announcement.findFirst({ where: { id, ...(managing ? {} : visibilityWhere(req.user.role, now())) }, select: announcementSelect(req.user.id) });
            if (!announcement) throw new AppError(404, "Announcement not found.");
            res.status(200).json({ success: true, data: { announcement: mapAnnouncement(announcement) } });
        },
        update: async (req, res) => {
            const id = positiveId(req.params.announcementId, "announcementId");
            const data = updatePayload(req.body, now());
            const existing = await prismaClient.announcement.findUnique({ where: { id }, select: { id: true } });
            if (!existing) throw new AppError(404, "Announcement not found.");
            const announcement = await prismaClient.announcement.update({ where: { id }, data, select: announcementSelect(req.user.id) });
            res.status(200).json({ success: true, data: { announcement: mapAnnouncement(announcement) } });
        },
        remove: async (req, res) => {
            const id = positiveId(req.params.announcementId, "announcementId");
            const existing = await prismaClient.announcement.findUnique({ where: { id }, select: { id: true } });
            if (!existing) throw new AppError(404, "Announcement not found.");
            await prismaClient.announcement.delete({ where: { id } });
            res.status(200).json({ success: true, data: { deleted: true } });
        },
        markRead: async (req, res) => {
            const id = positiveId(req.params.announcementId, "announcementId");
            const managing = req.user.role === "ADMIN" || req.user.role === "EXECUTIVE";
            const announcement = await prismaClient.announcement.findFirst({ where: { id, ...(managing ? {} : visibilityWhere(req.user.role, now())) }, select: { id: true } });
            if (!announcement) throw new AppError(404, "Announcement not found.");
            try {
                const read = await prismaClient.announcementRead.create({ data: { announcementId: id, userId: req.user.id }, select: { id: true, readAt: true } });
                res.status(201).json({ success: true, data: { read, created: true } });
            } catch (error) {
                if (!uniqueViolation(error)) throw error;
                const read = await prismaClient.announcementRead.findUnique({ where: { announcementId_userId: { announcementId: id, userId: req.user.id } }, select: { id: true, readAt: true } });
                res.status(200).json({ success: true, data: { read, created: false } });
            }
        },
        readStatistics: async (req, res) => {
            const id = positiveId(req.params.announcementId, "announcementId");
            const announcement = await prismaClient.announcement.findUnique({ where: { id }, select: { id: true, title: true, targetRoles: true, _count: { select: { reads: true } } } });
            if (!announcement) throw new AppError(404, "Announcement not found.");
            const eligibleWhere = announcement.targetRoles.length ? { isActive: true, role: { name: { in: announcement.targetRoles } } } : { isActive: true };
            const eligibleEmployees = await prismaClient.user.count({ where: eligibleWhere });
            res.status(200).json({ success: true, data: { announcement: { id: announcement.id, title: announcement.title }, readCount: announcement._count.reads, eligibleEmployees, unreadCount: Math.max(0, eligibleEmployees - announcement._count.reads) } });
        },
    };
}
