import assert from "node:assert/strict";
import test from "node:test";
import { createAnnouncementController } from "../src/controllers/announcementController.js";

function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const admin = { id: 1, role: "ADMIN" };
const inside = { id: 2, role: "INSIDE_SALES" };
const record = { id: 8, title: "Update", content: "Details", category: "OPERATIONS", priority: "NORMAL", isPublished: true, expiresAt: null, targetRoles: ["INSIDE_SALES"], createdAt: new Date(), updatedAt: new Date(), createdBy: { id: 1, fullName: "Admin", email: "admin@test", role: { name: "ADMIN" } }, reads: [] };

test("creates announcements from the authenticated creator with validated fields", async () => {
    let data;
    const controller = createAnnouncementController({ prismaClient: { announcement: { create: async (input) => { data = input.data; return record; } } } });
    const res = response();
    await controller.create({ user: admin, body: { title: " Update ", content: " Details ", category: "OPERATIONS", targetRoles: ["INSIDE_SALES"] } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(data.createdById, admin.id);
    assert.equal(data.priority, "NORMAL");
    await assert.rejects(() => controller.create({ user: admin, body: { ...data, createdById: 99 } }, response()), { statusCode: 400 });
});

test("rejects expired notices and persists a future expiry", async () => {
    let data;
    const now = new Date("2026-11-14T10:00:00.000Z");
    const controller = createAnnouncementController({
        now: () => now,
        prismaClient: { announcement: { create: async (input) => { data = input.data; return record; } } },
    });
    await assert.rejects(() => controller.create({
        user: admin,
        body: { title: "Expired", content: "Old notice", category: "HOLIDAY", expiresAt: "2026-11-14T09:59:59.000Z" },
    }, response()), { statusCode: 400 });
    await controller.create({
        user: admin,
        body: { title: "Holiday", content: "Office closure", category: "HOLIDAY", expiresAt: "2026-11-15T10:00:00.000Z" },
    }, response());
    assert.equal(data.expiresAt.toISOString(), "2026-11-15T10:00:00.000Z");
});

test("employee listing constrains visibility to published, current role-targeted announcements", async () => {
    let where;
    const controller = createAnnouncementController({ prismaClient: { $transaction: async (items) => Promise.all(items), announcement: { findMany: async (input) => { where = input.where; return [record]; }, count: async () => 1 } } });
    const res = response();
    await controller.list({ user: inside, query: {} }, res);
    assert.equal(where.isPublished, true);
    assert.equal(where.AND[1].OR[1].targetRoles.has, "INSIDE_SALES");
    assert.equal(res.body.data.announcements[0].isRead, false);
});

test("read receipts are idempotent under a unique-constraint race", async () => {
    const controller = createAnnouncementController({ prismaClient: {
        announcement: { findFirst: async () => ({ id: record.id }) },
        announcementRead: {
            create: async () => { const error = new Error(); error.code = "P2002"; throw error; },
            findUnique: async () => ({ id: 4, readAt: new Date() }),
        },
    } });
    const res = response();
    await controller.markRead({ user: inside, params: { announcementId: "8" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.created, false);
});
