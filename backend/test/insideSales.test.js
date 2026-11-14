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
    { id: 1, fullName: "Inside Sales One", email: "inside-one@example.com", phone: "1111111111", profileImageUrl: "https://example.com/profile.jpg", passwordHash: "must-not-leak", isActive: true, role: { name: "INSIDE_SALES" } },
    { id: 2, fullName: "Inside Sales Two", email: "inside-two@example.com", isActive: true, role: { name: "INSIDE_SALES" } },
    { id: 3, fullName: "Outside Sales", email: "outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 4, fullName: "Available Outside Sales", email: "available-outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 5, fullName: "Inactive Outside Sales", email: "inactive-outside@example.com", isActive: false, role: { name: "OUTSIDE_SALES" } },
    { id: 6, fullName: "Active Admin", email: "admin@example.com", isActive: true, role: { name: "ADMIN" } },
    { id: 7, fullName: "Inactive Inside Sales", email: "inactive-inside@example.com", isActive: false, role: { name: "INSIDE_SALES" } },
    { id: 8, fullName: "Empty Inside Sales", email: "empty-inside@example.com", isActive: true, role: { name: "INSIDE_SALES" } },
];

const customers = [
    { id: 11, fullName: "Assigned Customer", email: "assigned@example.com", phone: "1111111111", address: null, status: "ASSIGNED", interestStatus: "PENDING", createdAt: new Date(), updatedAt: new Date(), assignment: { insideSalesEmployeeId: 1, assignedAt: new Date("2026-11-10T10:00:00Z") } },
    { id: 12, fullName: "Other Customer", email: "other@example.com", phone: "2222222222", address: null, status: "ASSIGNED", interestStatus: "PENDING", createdAt: new Date(), updatedAt: new Date(), assignment: { insideSalesEmployeeId: 2, assignedAt: new Date("2026-11-11T10:00:00Z") } },
];
const callLogs = [
    { id: 1, customerId: 11, employeeId: 1, propertyId: null, outcome: "NO_ANSWER", notes: null, calledAt: new Date("2026-11-10T11:00:00Z") },
    { id: 2, customerId: 11, employeeId: 2, propertyId: null, outcome: "INTERESTED", notes: "Other employee", calledAt: new Date("2026-11-11T11:00:00Z") },
];
let nextCallLogId = 3;
const properties = [
    { id: 21, title: "Available Property", description: "Ready to visit", location: "Central", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, price: "1000000", status: "AVAILABLE" },
    { id: 22, title: "Sold Property", description: "Unavailable", location: "North", latitude: null, longitude: null, verificationRadiusMeters: 200, price: "2000000", status: "SOLD" },
];
const schedules = [
    { id: 101, customerId: 11, propertyId: 21, insideSalesEmployeeId: 1, outsideSalesEmployeeId: 4, scheduledByUserId: 1, scheduledAt: new Date("2026-12-20T10:00:00Z"), status: "SCHEDULED", notes: null, createdAt: new Date(), visit: null },
    { id: 102, customerId: 12, propertyId: 21, insideSalesEmployeeId: 2, outsideSalesEmployeeId: 4, scheduledByUserId: 2, scheduledAt: new Date("2026-12-21T10:00:00Z"), status: "SCHEDULED", notes: null, createdAt: new Date(), visit: null },
    { id: 103, customerId: 11, propertyId: 21, insideSalesEmployeeId: 1, outsideSalesEmployeeId: 4, scheduledByUserId: 1, scheduledAt: new Date("2026-12-22T10:00:00Z"), status: "COMPLETED", notes: null, createdAt: new Date(), visit: null },
    { id: 104, customerId: 11, propertyId: 21, insideSalesEmployeeId: 1, outsideSalesEmployeeId: 4, scheduledByUserId: 1, scheduledAt: new Date("2026-12-23T10:00:00Z"), status: "SCHEDULED", notes: null, createdAt: new Date(), visit: { id: 400, status: "IN_PROGRESS" } },
];
let nextScheduleId = 105;

function isOwnedCustomer(customer, where) {
    return (!where.id || customer.id === where.id)
        && customer.assignment?.insideSalesEmployeeId === where.assignment?.is?.insideSalesEmployeeId;
}

const prismaClient = {
    user: {
        async findUnique({ where }) { return users.find((user) => user.id === where.id) ?? null; },
        async findFirst({ where }) {
            return users.find((user) => user.id === where.id
                && user.isActive === where.isActive
                && user.role.name === where.role?.name) ?? null;
        },
    },
    customer: {
        async findMany({ where, skip, take }) {
            return customers.filter((customer) => isOwnedCustomer(customer, where)).slice(skip, skip + take);
        },
        async count({ where }) {
            return customers.filter((customer) => isOwnedCustomer(customer, where)
                && (where.interestStatus === undefined || customer.interestStatus === where.interestStatus)).length;
        },
        async findFirst({ where }) { return customers.find((customer) => isOwnedCustomer(customer, where)) ?? null; },
        async updateMany({ where, data }) {
            const customer = customers.find((candidate) => isOwnedCustomer(candidate, where));
            if (!customer) return { count: 0 };
            Object.assign(customer, data, { updatedAt: new Date() });
            return { count: 1 };
        },
    },
    callLog: {
        async findMany({ where }) {
            return callLogs
                .filter((log) => log.customerId === where.customerId && log.employeeId === where.employeeId)
                .sort((left, right) => right.calledAt - left.calledAt || right.id - left.id);
        },
        async create({ data }) {
            const callLog = { id: nextCallLogId, ...data, calledAt: new Date() };
            nextCallLogId += 1;
            callLogs.push(callLog);
            return callLog;
        },
        async count({ where }) {
            return callLogs.filter((callLog) => callLog.employeeId === where.employeeId
                && (where.outcome === undefined || callLog.outcome === where.outcome)).length;
        },
    },
    property: {
        async findUnique({ where }) { return properties.find((property) => property.id === where.id) ?? null; },
        async findFirst({ where }) { return properties.find((property) => property.id === where.id && property.status === where.status) ?? null; },
        async findMany({ where, skip, take }) {
            return properties.filter((property) => property.status === where.status).slice(skip, skip + take);
        },
        async count({ where }) { return properties.filter((property) => property.status === where.status).length; },
    },
    visitSchedule: {
        async findMany({ where, skip, take }) {
            return schedules.filter((schedule) => schedule.insideSalesEmployeeId === where.insideSalesEmployeeId).slice(skip, skip + take);
        },
        async count({ where }) {
            return schedules.filter((schedule) => schedule.insideSalesEmployeeId === where.insideSalesEmployeeId
                && (where.status === undefined || schedule.status === where.status)).length;
        },
        async findFirst({ where }) {
            return schedules.find((schedule) => {
                if (where.id !== undefined && schedule.id !== where.id) return false;
                if (where.id?.not !== undefined && schedule.id === where.id.not) return false;
                if (where.insideSalesEmployeeId !== undefined && schedule.insideSalesEmployeeId !== where.insideSalesEmployeeId) return false;
                if (where.customerId !== undefined && schedule.customerId !== where.customerId) return false;
                if (where.propertyId !== undefined && schedule.propertyId !== where.propertyId) return false;
                if (where.outsideSalesEmployeeId !== undefined && schedule.outsideSalesEmployeeId !== where.outsideSalesEmployeeId) return false;
                if (where.scheduledAt !== undefined && schedule.scheduledAt.getTime() !== where.scheduledAt.getTime()) return false;
                if (where.status?.in && !where.status.in.includes(schedule.status)) return false;
                if (where.visit === null && schedule.visit !== null) return false;
                return true;
            }) ?? null;
        },
        async create({ data }) {
            const duplicate = schedules.find((schedule) => schedule.customerId === data.customerId
                && schedule.propertyId === data.propertyId
                && schedule.outsideSalesEmployeeId === data.outsideSalesEmployeeId
                && schedule.scheduledAt.getTime() === data.scheduledAt.getTime()
                && ["SCHEDULED", "RESCHEDULED"].includes(schedule.status));
            if (duplicate) {
                const error = new Error("Serialization conflict");
                error.code = "P2034";
                throw error;
            }
            const schedule = { id: nextScheduleId, ...data, status: "SCHEDULED", createdAt: new Date(), visit: null };
            nextScheduleId += 1;
            schedules.push(schedule);
            return schedule;
        },
        async updateMany({ where, data }) {
            const schedule = await this.findFirst({ where });
            if (!schedule) return { count: 0 };
            Object.assign(schedule, data);
            return { count: 1 };
        },
    },
    async $transaction(operations, options) {
        if (typeof operations === "function") return operations(this);
        return Promise.all(operations);
    },
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
    return fetch(`${baseUrl}/api/inside-sales${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
    });
}

test("lists only customers assigned to the authenticated inside-sales employee", async () => {
    const response = await request("/customers?page=1&pageSize=1", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.customers.map((customer) => customer.id), [11]);
    assert.deepEqual(body.data.pagination, { page: 1, pageSize: 1, total: 1, totalPages: 1 });
});

test("rejects non-inside-sales roles and invalid pagination", async () => {
    const forbidden = await request("/customers", users[2]);
    const invalidPage = await request("/customers?page=0", users[0]);

    assert.equal(forbidden.status, 403);
    assert.equal(invalidPage.status, 400);
});

test("does not expose or change a different employee's customer", async () => {
    const detail = await request("/customers/12", users[0]);
    const logs = await request("/customers/12/call-logs", users[0]);
    const interest = await request("/customers/12/interest", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interestStatus: "INTERESTED" }),
    });

    assert.equal(detail.status, 404);
    assert.equal(logs.status, 404);
    assert.equal(interest.status, 404);
    assert.equal(customers[1].interestStatus, "PENDING");
});

test("returns only the authenticated employee's call logs and records call ownership from the token", async () => {
    const listed = await request("/customers/11/call-logs", users[0]);
    const created = await request("/customers/11/call-logs", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "CALL_BACK", notes: "  Call tomorrow  ", propertyId: 21 }),
    });
    const listedBody = await listed.json();
    const createdBody = await created.json();

    assert.equal(listed.status, 200);
    assert.deepEqual(listedBody.data.callLogs.map((callLog) => callLog.id), [1]);
    assert.equal(created.status, 201);
    assert.equal(createdBody.data.callLog.employeeId, users[0].id);
    assert.equal(createdBody.data.callLog.notes, "Call tomorrow");
});

test("validates call-log and interest request bodies before writes", async () => {
    const invalidOutcome = await request("/customers/11/call-logs", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "DONE" }),
    });
    const missingProperty = await request("/customers/11/call-logs", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "INTERESTED", propertyId: 999 }),
    });
    const invalidInterest = await request("/customers/11/interest", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interestStatus: "MAYBE" }),
    });
    const updated = await request("/customers/11/interest", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interestStatus: "INTERESTED" }),
    });

    assert.equal(invalidOutcome.status, 400);
    assert.equal(missingProperty.status, 404);
    assert.equal(invalidInterest.status, 400);
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.customer.interestStatus, "INTERESTED");
});

test("lists paginated available properties with safe property fields", async () => {
    const response = await request("/properties?page=1&pageSize=20", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.properties.map((property) => property.id), [21]);
    assert.equal(body.data.properties[0].status, "AVAILABLE");
    assert.equal("documents" in body.data.properties[0], false);
    assert.deepEqual(body.data.pagination, { page: 1, pageSize: 20, total: 1, totalPages: 1 });
});

test("lists only visit schedules owned by the authenticated inside-sales employee", async () => {
    const response = await request("/visit-schedules", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.schedules.map((schedule) => schedule.id), [101, 103, 104]);
    assert.equal(body.data.schedules.some((schedule) => schedule.id === 102), false);
});

test("creates a schedule only for assigned customers, available properties, and active outside-sales employees", async () => {
    const response = await request("/visit-schedules", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customerId: 11,
            propertyId: 21,
            outsideSalesEmployeeId: 4,
            scheduledAt: "2026-12-24T10:00:00Z",
            notes: "  Customer confirmed  ",
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.schedule.insideSalesEmployeeId, users[0].id);
    assert.equal(body.data.schedule.scheduledByUserId, users[0].id);
    assert.equal(body.data.schedule.notes, "Customer confirmed");
});

test("rejects schedule creation for invalid, unavailable, unassigned, inactive, and wrong-role inputs", async () => {
    const makeRequest = (body) => request("/visit-schedules", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const base = { customerId: 11, propertyId: 21, outsideSalesEmployeeId: 4, scheduledAt: "2026-12-25T10:00:00Z" };
    const invalid = await makeRequest({ ...base, scheduledAt: "tomorrow" });
    const unassigned = await makeRequest({ ...base, customerId: 12 });
    const unavailable = await makeRequest({ ...base, propertyId: 22 });
    const inactive = await makeRequest({ ...base, outsideSalesEmployeeId: 5 });
    const wrongRole = await makeRequest({ ...base, outsideSalesEmployeeId: 6 });

    assert.equal(invalid.status, 400);
    assert.equal(unassigned.status, 404);
    assert.equal(unavailable.status, 409);
    assert.equal(inactive.status, 400);
    assert.equal(wrongRole.status, 400);
});

test("prevents duplicate concurrent schedules", async () => {
    const payload = {
        customerId: 11, propertyId: 21, outsideSalesEmployeeId: 4, scheduledAt: "2026-12-26T10:00:00Z",
    };
    const responses = await Promise.all([
        request("/visit-schedules", users[0], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
        request("/visit-schedules", users[0], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    ]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(schedules.filter((schedule) => schedule.scheduledAt.getTime() === new Date(payload.scheduledAt).getTime()).length, 1);
});

test("reschedules and cancels only eligible schedules owned by the inside-sales employee", async () => {
    const rescheduled = await request("/visit-schedules/101", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: "2026-12-27T10:00:00Z", notes: "Rescheduled" }),
    });
    const cancelled = await request("/visit-schedules/101", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", notes: "Customer cancelled" }),
    });
    const otherEmployee = await request("/visit-schedules/102", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }),
    });
    const completed = await request("/visit-schedules/103", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }),
    });
    const executing = await request("/visit-schedules/104", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }),
    });

    assert.equal(rescheduled.status, 200);
    assert.equal((await rescheduled.json()).data.schedule.status, "RESCHEDULED");
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).data.schedule.status, "CANCELLED");
    assert.equal(otherEmployee.status, 404);
    assert.equal(completed.status, 409);
    assert.equal(executing.status, 409);
});

test("rejects invalid schedule update transitions and non-inside-sales access", async () => {
    const invalidBody = await request("/visit-schedules/101", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "SCHEDULED" }),
    });
    const forbidden = await request("/visit-schedules", users[2]);

    assert.equal(invalidBody.status, 400);
    assert.equal(forbidden.status, 403);
});

test("returns dashboard counts scoped to the authenticated inside-sales employee", async () => {
    const response = await request("/dashboard", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
        assignedCustomers: 1,
        interestStatuses: { PENDING: 0, INTERESTED: 1, NOT_INTERESTED: 0 },
        callActivity: {
            total: 2,
            byOutcome: { INTERESTED: 0, NOT_INTERESTED: 0, NO_ANSWER: 1, CALL_BACK: 1, INVALID_NUMBER: 0 },
        },
        visitSchedules: {
            total: 5,
            byStatus: { SCHEDULED: 3, RESCHEDULED: 0, CANCELLED: 1, COMPLETED: 1 },
        },
    });
});

test("returns zero-filled dashboard statistics for an employee with no records", async () => {
    const response = await request("/dashboard", users[7]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
        assignedCustomers: 0,
        interestStatuses: { PENDING: 0, INTERESTED: 0, NOT_INTERESTED: 0 },
        callActivity: {
            total: 0,
            byOutcome: { INTERESTED: 0, NOT_INTERESTED: 0, NO_ANSWER: 0, CALL_BACK: 0, INVALID_NUMBER: 0 },
        },
        visitSchedules: {
            total: 0,
            byStatus: { SCHEDULED: 0, RESCHEDULED: 0, CANCELLED: 0, COMPLETED: 0 },
        },
    });
});

test("returns a safe profile for the authenticated inside-sales employee", async () => {
    const response = await request("/profile", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.profile, {
        id: 1,
        fullName: "Inside Sales One",
        email: "inside-one@example.com",
        phone: "1111111111",
        profileImageUrl: "https://example.com/profile.jpg",
        role: "INSIDE_SALES",
    });
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
    assert.equal(JSON.stringify(body).includes("must-not-leak"), false);
});

test("denies dashboard and profile access to other, missing, and inactive users", async () => {
    const wrongRole = await request("/dashboard", users[2]);
    const missing = await request("/profile", { id: 999 });
    const inactive = await request("/profile", users[6]);

    assert.equal(wrongRole.status, 403);
    assert.equal(missing.status, 401);
    assert.equal(inactive.status, 401);
});
