import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", isActive: true, role: { name: "ADMIN" } },
    { id: 2, fullName: "Executive User", email: "executive@example.com", isActive: true, role: { name: "EXECUTIVE" } },
    { id: 3, fullName: "Outside User", email: "outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
];
const properties = [
    {
        id: 21, title: "Available Property", description: "Ready", location: "Central", latitude: 12.1, longitude: 77.1,
        verificationRadiusMeters: 200, price: "1000000.00", status: "AVAILABLE", createdAt: new Date("2026-11-10T10:00:00Z"), updatedAt: new Date(),
        documents: [{ id: 1 }], visitSchedules: [{ id: 1 }], internalCode: "not-safe",
    },
    {
        id: 22, title: "Sold Property", description: null, location: "North", latitude: null, longitude: null,
        verificationRadiusMeters: 300, price: "2000000.00", status: "SOLD", createdAt: new Date("2026-11-11T10:00:00Z"), updatedAt: new Date(),
    },
];
let nextPropertyId = 23;

function matchesWhere(property, where) {
    return (where.id === undefined || property.id === where.id)
        && (where.status === undefined || property.status === where.status);
}

const prismaClient = {
    user: {
        async findUnique({ where }) { return users.find((user) => user.id === where.id) ?? null; },
    },
    property: {
        async findMany({ where, skip, take }) {
            return properties
                .filter((property) => matchesWhere(property, where))
                .sort((left, right) => right.createdAt - left.createdAt || left.id - right.id)
                .slice(skip, skip + take);
        },
        async count({ where }) { return properties.filter((property) => matchesWhere(property, where)).length; },
        async findUnique({ where }) { return properties.find((property) => property.id === where.id) ?? null; },
        async create({ data }) {
            const property = {
                id: nextPropertyId,
                description: null,
                latitude: null,
                longitude: null,
                verificationRadiusMeters: 200,
                status: "AVAILABLE",
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            nextPropertyId += 1;
            properties.push(property);
            return property;
        },
        async update({ where, data }) {
            const property = properties.find((candidate) => candidate.id === where.id);
            Object.assign(property, data, { updatedAt: new Date() });
            return property;
        },
    },
    async $transaction(operations) { return Promise.all(operations); },
};

const app = createApp({ prismaClient, jwtConfig });
let server;
let baseUrl;

before(async () => {
    server = await new Promise((resolve) => {
        const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function tokenFor(user) {
    return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
        algorithm: "HS256", expiresIn: "1h", issuer: jwtConfig.issuer, audience: jwtConfig.audience,
    });
}

function request(path, user, options = {}) {
    return fetch(`${baseUrl}/api/admin${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
    });
}

test("allows ADMIN and EXECUTIVE to list paginated properties with status filters", async () => {
    const all = await request("/properties?page=1&pageSize=1", users[0]);
    const filtered = await request("/properties?status=AVAILABLE", users[1]);
    const allBody = await all.json();
    const filteredBody = await filtered.json();

    assert.equal(all.status, 200);
    assert.deepEqual(allBody.data.properties.map((property) => property.id), [22]);
    assert.deepEqual(allBody.data.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
    assert.equal(filtered.status, 200);
    assert.deepEqual(filteredBody.data.properties.map((property) => property.id), [21]);
});

test("denies property management to other roles and validates query values", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/admin/properties`);
    const forbidden = await request("/properties", users[2]);
    const invalidStatus = await request("/properties?status=ARCHIVED", users[0]);
    const invalidPage = await request("/properties?page=0", users[0]);

    assert.equal(unauthenticated.status, 401);
    assert.equal(forbidden.status, 403);
    assert.equal(invalidStatus.status, 400);
    assert.equal(invalidPage.status, 400);
});

test("creates a property while preserving GPS verification fields", async () => {
    const response = await request("/properties", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: " New Property ",
            description: "  GPS ready  ",
            location: " New Location ",
            price: "123456.78",
            latitude: 12.9716,
            longitude: 77.5946,
            verificationRadiusMeters: 200,
            status: "AVAILABLE",
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.property.title, "New Property");
    assert.equal(body.data.property.latitude, 12.9716);
    assert.equal(body.data.property.longitude, 77.5946);
    assert.equal(body.data.property.verificationRadiusMeters, 200);
});

test("returns details with only safe explicitly selected fields", async () => {
    const response = await request("/properties/21", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.property.status, "AVAILABLE");
    assert.equal(JSON.stringify(body).includes("documents"), false);
    assert.equal(JSON.stringify(body).includes("visitSchedules"), false);
    assert.equal(JSON.stringify(body).includes("internalCode"), false);
});

test("updates property details, status, GPS coordinates and verification radius", async () => {
    const response = await request("/properties/22", users[1], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: "INACTIVE",
            price: "2100000.50",
            latitude: 13.0,
            longitude: 78.0,
            verificationRadiusMeters: 200,
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.property.status, "INACTIVE");
    assert.equal(body.data.property.latitude, 13);
    assert.equal(body.data.property.longitude, 78);
    assert.equal(body.data.property.verificationRadiusMeters, 200);
});

test("rejects invalid property payloads, coordinates, prices, radii, and statuses", async () => {
    const invalidCoordinates = await request("/properties", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Bad", location: "Somewhere", price: "100.00", latitude: 91, longitude: 0 }),
    });
    const partialCoordinates = await request("/properties/21", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: 12 }),
    });
    const invalidPrice = await request("/properties/21", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: "1.999" }),
    });
    const invalidRadius = await request("/properties/21", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationRadiusMeters: 0 }),
    });
    const invalidStatus = await request("/properties/21", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ARCHIVED" }),
    });
    const missing = await request("/properties/999", users[0]);
    const invalidId = await request("/properties/invalid", users[0]);

    assert.equal(invalidCoordinates.status, 400);
    assert.equal(partialCoordinates.status, 400);
    assert.equal(invalidPrice.status, 400);
    assert.equal(invalidRadius.status, 400);
    assert.equal(invalidStatus.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(invalidId.status, 400);
});
