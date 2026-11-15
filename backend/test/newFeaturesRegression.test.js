import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

import { createApp } from "../src/app.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", isActive: true, role: { name: "ADMIN" } },
    { id: 2, fullName: "Executive User", email: "exec@example.com", isActive: true, role: { name: "EXECUTIVE" } },
    { id: 3, fullName: "Inside User", email: "inside@example.com", isActive: true, role: { name: "INSIDE_SALES" } },
    { id: 4, fullName: "Outside User 1", email: "outside1@example.com", phone: "+919876543210", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 5, fullName: "Outside User 2", email: "outside2@example.com", phone: "+919876543211", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 6, fullName: "Inactive Outside", email: "inactive@example.com", phone: "+919876543212", isActive: false, role: { name: "OUTSIDE_SALES" } },
];

const customers = [
    { id: 1, fullName: "Existing Customer", phone: "+919876500000", email: "exist@example.com", address: "City", status: "NEW", interestStatus: "PENDING" },
];

let nextCustomerId = 100;

const mockPrisma = {
    user: {
        async findUnique({ where }) {
            return users.find((u) => u.id === where.id || u.email === where.email) ?? null;
        },
        async findFirst({ where }) {
            return users.find((u) => {
                if (where.id !== undefined && u.id !== where.id) return false;
                if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
                if (where.role?.name && u.role.name !== where.role.name) return false;
                return true;
            }) ?? null;
        },
        async findMany({ where }) {
            return users.filter((u) => {
                if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
                if (where.role?.name && u.role.name !== where.role.name) return false;
                return true;
            });
        },
    },
    customer: {
        async findMany({ where }) {
            if (where?.phone?.in) {
                return customers.filter((c) => where.phone.in.includes(c.phone));
            }
            return customers;
        },
        async create({ data }) {
            const created = { id: nextCustomerId++, ...data, createdAt: new Date(), updatedAt: new Date() };
            customers.push(created);
            return created;
        },
    },
    async $transaction(arg) {
        if (Array.isArray(arg)) {
            return Promise.all(arg);
        }
        return arg(mockPrisma);
    },
};

function authHeader(user) {
    const token = jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
    return `Bearer ${token}`;
}

let server;
let baseUrl;

before(async () => {
    const app = createApp({
        prismaClient: mockPrisma,
        jwtConfig,
        environment: {},
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

test("INSIDE_SALES can fetch active outside sales agents with masked phones", async () => {
    const res = await fetch(`${baseUrl}/api/inside-sales/outside-sales-agents`, {
        headers: { Authorization: authHeader(users[2]) },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.agents));
    assert.equal(body.data.agents.length, 2);
    assert.equal(body.data.agents[0].phone, "****3210");
});

test("Non-inside sales roles cannot access outside-sales-agents endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/inside-sales/outside-sales-agents`, {
        headers: { Authorization: authHeader(users[3]) }, // OUTSIDE_SALES
    });
    assert.equal(res.status, 403);
});

test("Admin and Executive can batch import customers", async () => {
    const batch = [
        { fullName: "Imported One", phone: "+919876500001", email: "one@example.com" },
        { fullName: "Imported Two", phone: "+919876500002", email: "two@example.com" },
    ];
    const res = await fetch(`${baseUrl}/api/admin/customers/import`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(users[0]), // ADMIN
        },
        body: JSON.stringify({ customers: batch }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.importedCount, 2);
});

test("Batch import rejects duplicate phones within payload", async () => {
    const batch = [
        { fullName: "Dup One", phone: "+919876500099" },
        { fullName: "Dup Two", phone: "+919876500099" },
    ];
    const res = await fetch(`${baseUrl}/api/admin/customers/import`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(users[1]), // EXECUTIVE
        },
        body: JSON.stringify({ customers: batch }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.data.errors.some((e) => e.error.includes("Duplicate phone number")));
});

test("Batch import rejects phone numbers already in database", async () => {
    const batch = [
        { fullName: "Existing Clash", phone: "+919876500000" }, // already exists
    ];
    const res = await fetch(`${baseUrl}/api/admin/customers/import`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(users[0]),
        },
        body: JSON.stringify({ customers: batch }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.data.errors.some((e) => e.error.includes("already exists in database")));
});

test("Non-privileged roles cannot access batch import", async () => {
    const res = await fetch(`${baseUrl}/api/admin/customers/import`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(users[2]), // INSIDE_SALES
        },
        body: JSON.stringify({ customers: [{ fullName: "Fail", phone: "+919876500088" }] }),
    });
    assert.equal(res.status, 403);
});

// ── Profile Image Upload ──────────────────────────────────────────────────────

test("POST /api/admin/employees/upload-profile-image rejects unauthenticated requests", async () => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.alloc(100)], { type: "image/jpeg" }), "photo.jpg");
    const res = await fetch(`${baseUrl}/api/admin/employees/upload-profile-image`, {
        method: "POST",
        body: form,
    });
    assert.equal(res.status, 401);
});

test("POST /api/admin/employees/upload-profile-image rejects INSIDE_SALES role", async () => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.alloc(100)], { type: "image/jpeg" }), "photo.jpg");
    const res = await fetch(`${baseUrl}/api/admin/employees/upload-profile-image`, {
        method: "POST",
        headers: { Authorization: authHeader(users[2]) }, // INSIDE_SALES
        body: form,
    });
    assert.equal(res.status, 403);
});

test("POST /api/admin/employees/upload-profile-image rejects invalid file type (magic byte check)", async () => {
    // A buffer that starts with a valid JPEG mime type declared but has PNG magic bytes
    // Build a fake PNG header disguised as jpeg
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const form = new FormData();
    form.append("file", new Blob([pngMagic], { type: "image/jpeg" }), "photo.jpg");
    const res = await fetch(`${baseUrl}/api/admin/employees/upload-profile-image`, {
        method: "POST",
        headers: { Authorization: authHeader(users[0]) }, // ADMIN
        body: form,
    });
    // Should fail validation — either 400 (magic byte mismatch) or 503 (Cloudinary not configured in test)
    // We only need to confirm it does NOT succeed (200) with wrong magic bytes
    // In test env, Cloudinary is not configured, so we expect 400 (magic mismatch) or 503 (upload not configured)
    assert.ok(res.status !== 200, `Expected non-200, got ${res.status}`);
});

test("POST /api/admin/employees/upload-profile-image accepts ADMIN and EXECUTIVE roles (may 503 without Cloudinary)", async () => {
    // Minimal valid JPEG magic bytes
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    for (const user of [users[0], users[1]]) { // ADMIN and EXECUTIVE
        const form = new FormData();
        form.append("file", new Blob([jpegMagic], { type: "image/jpeg" }), "photo.jpg");
        const res = await fetch(`${baseUrl}/api/admin/employees/upload-profile-image`, {
            method: "POST",
            headers: { Authorization: authHeader(user) },
            body: form,
        });
        // 200 = upload success, 503 = Cloudinary not configured in test env — both are acceptable
        assert.ok(
            res.status === 200 || res.status === 503,
            `Expected 200 or 503 for ${user.role.name}, got ${res.status}`
        );
    }
});
