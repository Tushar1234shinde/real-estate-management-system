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

const roles = [
    { id: 1, name: "ADMIN" },
    { id: 2, name: "EXECUTIVE" },
    { id: 3, name: "INSIDE_SALES" },
    { id: 4, name: "OUTSIDE_SALES" },
];
const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", phone: "1111111111", profileImageUrl: "https://example.com/admin.jpg", passwordHash: "private-hash", isActive: true, roleId: 1, role: { name: "ADMIN" } },
    { id: 2, fullName: "Executive User", email: "executive@example.com", phone: null, profileImageUrl: null, isActive: true, roleId: 2, role: { name: "EXECUTIVE" } },
    { id: 3, fullName: "Inside User", email: "inside@example.com", phone: "3333333333", isActive: false, roleId: 3, role: { name: "INSIDE_SALES" } },
    { id: 4, fullName: "Outside User", email: "outside@example.com", phone: null, profileImageUrl: null, isActive: true, roleId: 4, role: { name: "OUTSIDE_SALES" } },
];
const customers = [
    { id: 1, status: "NEW", interestStatus: "PENDING", assignment: null, fullName: "Private Customer" },
    { id: 2, status: "ASSIGNED", interestStatus: "INTERESTED", assignment: { id: 20 }, fullName: "Private Customer" },
    { id: 3, status: "ASSIGNED", interestStatus: "PENDING", assignment: { id: 21 }, fullName: "Private Customer" },
];
const properties = [{ status: "AVAILABLE" }, { status: "SOLD" }, { status: "SOLD" }];
const callLogs = [{ outcome: "INTERESTED" }, { outcome: "NO_ANSWER" }, { outcome: "NO_ANSWER" }];
const visitSchedules = [{ status: "SCHEDULED" }, { status: "COMPLETED" }];
const visits = [{ status: "PENDING_REVIEW" }, { status: "REJECTED" }, { status: "COMPLETED" }];

function groupByRows(rows, by) {
    const groups = new Map();
    for (const row of rows) {
        const key = JSON.stringify(by.map((field) => row[field]));
        const entry = groups.get(key) ?? { ...Object.fromEntries(by.map((field) => [field, row[field]])), count: 0 };
        entry.count += 1;
        groups.set(key, entry);
    }
    return [...groups.values()].map(({ count, ...group }) => ({ ...group, _count: { _all: count } }));
}

function emptyPrisma() {
    return {
        role: { async findMany() { return roles; } },
        user: {
            async findUnique({ where }) { return users.find((user) => user.id === where.id) ?? null; },
            async groupBy({ by }) { return groupByRows(users, by); },
        },
        customer: {
            async groupBy({ by }) { return groupByRows(customers, by); },
            async count({ where }) {
                return customers.filter((customer) => where.assignment.isNot === null
                    ? customer.assignment !== null
                    : customer.assignment === null).length;
            },
        },
        property: { async groupBy({ by }) { return groupByRows(properties, by); } },
        callLog: { async groupBy({ by }) { return groupByRows(callLogs, by); } },
        visitSchedule: { async groupBy({ by }) { return groupByRows(visitSchedules, by); } },
        visit: { async groupBy({ by }) { return groupByRows(visits, by); } },
        async $transaction(operations) { return Promise.all(operations); },
    };
}

const prismaClient = emptyPrisma();
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

test("allows ADMIN and EXECUTIVE to read portfolio-wide dashboard aggregates", async () => {
    const adminResponse = await request("/dashboard", users[0]);
    const executiveResponse = await request("/dashboard", users[1]);
    const body = await adminResponse.json();

    assert.equal(adminResponse.status, 200);
    assert.equal(executiveResponse.status, 200);
    assert.deepEqual(body.data, {
        employees: {
            total: 4,
            byRoleAndStatus: {
                ADMIN: { active: 1, inactive: 0 },
                EXECUTIVE: { active: 1, inactive: 0 },
                INSIDE_SALES: { active: 0, inactive: 1 },
                OUTSIDE_SALES: { active: 1, inactive: 0 },
            },
        },
        customers: {
            total: 3,
            byStatus: { NEW: 1, ASSIGNED: 2, CONTACTED: 0, CONVERTED: 0, CLOSED: 0 },
            byInterestStatus: { PENDING: 2, INTERESTED: 1, NOT_INTERESTED: 0 },
            assigned: 2,
            unassigned: 1,
        },
        properties: { total: 3, byStatus: { AVAILABLE: 1, BOOKED: 0, SOLD: 2, INACTIVE: 0 } },
        callLogs: { total: 3, byOutcome: { INTERESTED: 1, NOT_INTERESTED: 0, NO_ANSWER: 2, CALL_BACK: 0, INVALID_NUMBER: 0 } },
        visitSchedules: { total: 2, byStatus: { SCHEDULED: 1, RESCHEDULED: 0, CANCELLED: 0, COMPLETED: 1 } },
        visits: { total: 3, byStatus: { IN_PROGRESS: 0, PENDING_REVIEW: 1, COMPLETED: 1, REJECTED: 1, CANCELLED: 0 } },
    });
    assert.equal(JSON.stringify(body).includes("Private Customer"), false);
    assert.equal(JSON.stringify(body).includes("private-hash"), false);
});

test("returns zero-filled buckets when the portfolio has no records", async () => {
    const emptyApp = createApp({ prismaClient: emptyPrismaWithNoRecords(), jwtConfig });
    const emptyServer = await new Promise((resolve) => {
        const listeningServer = emptyApp.listen(0, () => resolve(listeningServer));
    });
    try {
        const response = await fetch(`http://127.0.0.1:${emptyServer.address().port}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${tokenFor(users[0])}` },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body.data, {
            employees: {
                total: 0,
                byRoleAndStatus: {
                    ADMIN: { active: 0, inactive: 0 },
                    EXECUTIVE: { active: 0, inactive: 0 },
                    INSIDE_SALES: { active: 0, inactive: 0 },
                    OUTSIDE_SALES: { active: 0, inactive: 0 },
                },
            },
            customers: {
                total: 0,
                byStatus: { NEW: 0, ASSIGNED: 0, CONTACTED: 0, CONVERTED: 0, CLOSED: 0 },
                byInterestStatus: { PENDING: 0, INTERESTED: 0, NOT_INTERESTED: 0 },
                assigned: 0,
                unassigned: 0,
            },
            properties: { total: 0, byStatus: { AVAILABLE: 0, BOOKED: 0, SOLD: 0, INACTIVE: 0 } },
            callLogs: { total: 0, byOutcome: { INTERESTED: 0, NOT_INTERESTED: 0, NO_ANSWER: 0, CALL_BACK: 0, INVALID_NUMBER: 0 } },
            visitSchedules: { total: 0, byStatus: { SCHEDULED: 0, RESCHEDULED: 0, CANCELLED: 0, COMPLETED: 0 } },
            visits: { total: 0, byStatus: { IN_PROGRESS: 0, PENDING_REVIEW: 0, COMPLETED: 0, REJECTED: 0, CANCELLED: 0 } },
        });
    } finally {
        await new Promise((resolve, reject) => emptyServer.close((error) => (error ? reject(error) : resolve())));
    }
});

function emptyPrismaWithNoRecords() {
    const client = emptyPrisma();
    client.role.findMany = async () => roles;
    client.user.groupBy = async () => [];
    client.customer.groupBy = async () => [];
    client.customer.count = async () => 0;
    client.property.groupBy = async () => [];
    client.callLog.groupBy = async () => [];
    client.visitSchedule.groupBy = async () => [];
    client.visit.groupBy = async () => [];
    return client;
}

test("returns only safe profile fields for ADMIN and EXECUTIVE", async () => {
    const response = await request("/profile", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.profile, {
        id: 1,
        fullName: "Admin User",
        email: "admin@example.com",
        phone: "1111111111",
        profileImageUrl: "https://example.com/admin.jpg",
        role: "ADMIN",
    });
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
    assert.equal(JSON.stringify(body).includes("private-hash"), false);
});

test("denies unauthenticated and non-admin dashboard/profile requests", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/admin/dashboard`);
    const forbiddenDashboard = await request("/dashboard", users[3]);
    const forbiddenProfile = await request("/profile", users[3]);

    assert.equal(unauthenticated.status, 401);
    assert.equal(forbiddenDashboard.status, 403);
    assert.equal(forbiddenProfile.status, 403);
});
