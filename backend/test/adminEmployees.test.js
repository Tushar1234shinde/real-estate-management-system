import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

const roles = [
    { id: 1, name: "ADMIN", description: "Administrator" },
    { id: 2, name: "EXECUTIVE", description: "Executive" },
    { id: 3, name: "INSIDE_SALES", description: "Inside sales" },
    { id: 4, name: "OUTSIDE_SALES", description: "Outside sales" },
];
const users = [
    { id: 1, roleId: 1, fullName: "Admin User", email: "admin@example.com", phone: "+911111111111", profileImageUrl: null, passwordHash: "admin-hash", isActive: true, role: roles[0], createdAt: new Date(), updatedAt: new Date() },
    { id: 2, roleId: 2, fullName: "Executive User", email: "executive@example.com", phone: "+922222222222", profileImageUrl: null, passwordHash: "executive-hash", isActive: true, role: roles[1], createdAt: new Date(), updatedAt: new Date() },
    { id: 3, roleId: 3, fullName: "Inside User", email: "inside@example.com", phone: "+933333333333", profileImageUrl: null, passwordHash: "inside-hash", isActive: true, role: roles[2], createdAt: new Date(), updatedAt: new Date() },
    { id: 4, roleId: 4, fullName: "Inactive Outside", email: "outside@example.com", phone: "+944444444444", profileImageUrl: null, passwordHash: "outside-hash", isActive: false, role: roles[3], createdAt: new Date(), updatedAt: new Date() },
    { id: 5, roleId: 4, fullName: "Active Outside", email: "active-outside@example.com", phone: null, profileImageUrl: null, passwordHash: "active-outside-hash", isActive: true, role: roles[3], createdAt: new Date(), updatedAt: new Date() },
];
const assignments = [];
let nextUserId = 6;

function safeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safe } = user;
    return { ...safe, role: { ...safe.role } };
}

const prismaClient = {
    role: {
        async findUnique({ where }) { return roles.find((role) => role.name === where.name) ?? null; },
    },
    user: {
        async findUnique({ where }) {
            const user = where.id === undefined
                ? users.find((candidate) => candidate.email === where.email)
                : users.find((candidate) => candidate.id === where.id);
            return safeUser(user);
        },
        async findMany({ where, skip, take }) {
            return users
                .filter((user) => (where.isActive === undefined || user.isActive === where.isActive)
                    && (where.role === undefined || user.role.name === where.role.name))
                .sort((left, right) => left.fullName.localeCompare(right.fullName) || left.id - right.id)
                .slice(skip, skip + take)
                .map(safeUser);
        },
        async count({ where }) {
            return users.filter((user) => (where.isActive === undefined || user.isActive === where.isActive)
                && (where.role === undefined || user.role.name === where.role.name)).length;
        },
        async create({ data }) {
            if (users.some((user) => user.email === data.email || (data.phone !== null && user.phone === data.phone))) {
                const error = new Error("Unique constraint failed");
                error.code = "P2002";
                throw error;
            }
            const role = roles.find((candidate) => candidate.id === data.roleId);
            const user = { id: nextUserId, ...data, role, isActive: true, createdAt: new Date(), updatedAt: new Date() };
            nextUserId += 1;
            users.push(user);
            return safeUser(user);
        },
        async update({ where, data }) {
            const user = users.find((candidate) => candidate.id === where.id);
            if ((data.email && users.some((candidate) => candidate.id !== user.id && candidate.email === data.email))
                || (data.phone && users.some((candidate) => candidate.id !== user.id && candidate.phone === data.phone))) {
                const error = new Error("Unique constraint failed");
                error.code = "P2002";
                throw error;
            }
            Object.assign(user, data, { updatedAt: new Date() });
            if (data.roleId !== undefined) user.role = roles.find((role) => role.id === data.roleId);
            return safeUser(user);
        },
    },
    customerAssignment: {
        async count({ where }) {
            return assignments.filter((assignment) => assignment.insideSalesEmployeeId === where.insideSalesEmployeeId).length;
        },
    },
    async $transaction(operations) {
        if (typeof operations === "function") {
            return operations({ user: prismaClient.user, customerAssignment: prismaClient.customerAssignment });
        }
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
    return fetch(`${baseUrl}/api/admin${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
    });
}

function requestExecutive(path, user, options = {}) {
    return fetch(`${baseUrl}/api/executive${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
    });
}

test("allows ADMIN and EXECUTIVE employee listing with validated filters", async () => {
    const admin = await request("/employees?role=OUTSIDE_SALES&isActive=false&page=1&pageSize=10", users[0]);
    const executive = await request("/employees", users[1]);
    const invalid = await request("/employees?role=UNKNOWN", users[0]);
    const adminBody = await admin.json();

    assert.equal(admin.status, 200);
    assert.deepEqual(adminBody.data.employees.map((employee) => employee.id), [4]);
    assert.deepEqual(adminBody.data.pagination, { page: 1, pageSize: 10, total: 1, totalPages: 1 });
    assert.equal(executive.status, 200);
    assert.equal(invalid.status, 400);
});

test("denies employee management to non-admin roles", async () => {
    const response = await request("/employees", users[2]);
    assert.equal(response.status, 403);
});

test("creates an employee with a hashed password and safe response", async () => {
    const response = await request("/employees", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "New Inside Sales",
            email: "new-inside@example.com",
            password: "secure-password",
            role: "INSIDE_SALES",
            phone: "+955555555555",
            profileImageUrl: "https://example.com/new.jpg",
        }),
    });
    const body = await response.json();
    const stored = users.find((user) => user.id === body.data.employee.id);

    assert.equal(response.status, 201);
    assert.equal(body.data.employee.role.name, "INSIDE_SALES");
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
    assert.equal(await bcrypt.compare("secure-password", stored.passwordHash), true);
});

test("rejects invalid and duplicate employee creation payloads", async () => {
    const invalid = await request("/employees", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "", email: "bad", password: "short", role: "INVALID" }),
    });
    const duplicateEmail = await request("/employees", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Duplicate", email: "admin@example.com", password: "secure-password", role: "ADMIN" }),
    });
    const duplicatePhone = await request("/employees", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Duplicate", email: "duplicate@example.com", password: "secure-password", role: "ADMIN", phone: "+911111111111" }),
    });

    assert.equal(invalid.status, 400);
    assert.equal(duplicateEmail.status, 409);
    assert.equal(duplicatePhone.status, 409);
});

test("gets and updates employees without exposing sensitive fields", async () => {
    const detail = await request("/employees/3", users[0]);
    const updated = await request("/employees/3", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Updated Inside", role: "OUTSIDE_SALES", password: "new-secure-password" }),
    });
    const detailBody = await detail.json();
    const updatedBody = await updated.json();

    assert.equal(detail.status, 200);
    assert.equal(JSON.stringify(detailBody).includes("passwordHash"), false);
    assert.equal(updated.status, 200);
    assert.equal(updatedBody.data.employee.fullName, "Updated Inside");
    assert.equal(updatedBody.data.employee.role.name, "OUTSIDE_SALES");
    assert.equal(await bcrypt.compare("new-secure-password", users[2].passwordHash), true);
});

test("validates employee updates and returns not found for invalid identifiers", async () => {
    const empty = await request("/employees/3", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    const unsupported = await request("/employees/3", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }),
    });
    const missing = await request("/employees/999", users[0]);
    const invalidId = await request("/employees/nope", users[0]);

    assert.equal(empty.status, 400);
    assert.equal(unsupported.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(invalidId.status, 400);
});

test("activates and deactivates other employees but prevents self-deactivation", async () => {
    const activated = await request("/employees/4/status", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }),
    });
    const deactivated = await request("/employees/4/status", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }),
    });
    const self = await request("/employees/1/status", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }),
    });
    const invalid = await request("/employees/4/status", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: "false" }),
    });

    assert.equal(activated.status, 200);
    assert.equal(deactivated.status, 200);
    assert.equal((await deactivated.json()).data.employee.isActive, false);
    assert.equal(self.status, 409);
    assert.equal(invalid.status, 400);
});

test("ADMIN can create every declared employee role", async () => {
    const responses = await Promise.all(roles.map((role, index) => request("/employees", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: `Admin Created ${role.name}`,
            email: `admin-created-${index}@example.com`,
            password: "secure-password",
            role: role.name,
        }),
    })));
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status), [201, 201, 201, 201]);
    assert.deepEqual(bodies.map((body) => body.data.employee.role.name), roles.map((role) => role.name));
    assert.equal(bodies.some((body) => JSON.stringify(body).includes("passwordHash")), false);
});

test("EXECUTIVE can create only Inside Sales and Outside Sales employees", async () => {
    const createForRole = (role) => request("/employees", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: `Executive Created ${role}`,
            email: `executive-created-${role.toLowerCase()}@example.com`,
            password: "secure-password",
            role,
        }),
    });
    const allowed = await Promise.all([createForRole("INSIDE_SALES"), createForRole("OUTSIDE_SALES")]);
    const forbidden = await Promise.all([createForRole("ADMIN"), createForRole("EXECUTIVE")]);
    const allowedBodies = await Promise.all(allowed.map((response) => response.json()));

    assert.deepEqual(allowed.map((response) => response.status), [201, 201]);
    assert.deepEqual(allowedBodies.map((body) => body.data.employee.role.name), ["INSIDE_SALES", "OUTSIDE_SALES"]);
    assert.deepEqual(forbidden.map((response) => response.status), [403, 403]);
});

test("EXECUTIVE can list and view employees without sensitive fields", async () => {
    const list = await request("/employees", users[1]);
    const detail = await request("/employees/3", users[1]);
    const listBody = await list.json();
    const detailBody = await detail.json();

    assert.equal(list.status, 200);
    assert.equal(detail.status, 200);
    assert.ok(listBody.data.employees.some((employee) => employee.id === 3));
    for (const body of [listBody, detailBody]) {
        assert.equal(JSON.stringify(body).includes("passwordHash"), false);
        assert.equal(JSON.stringify(body).includes("inside-hash"), false);
    }
});

test("EXECUTIVE can update only name, phone, and image URL", async () => {
    const response = await request("/employees/3", users[1], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Executive Updated Inside",
            phone: "+966666666666",
            profileImageUrl: "https://example.com/executive-updated.jpg",
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.employee.fullName, "Executive Updated Inside");
    assert.equal(body.data.employee.phone, "+966666666666");
    assert.equal(body.data.employee.profileImageUrl, "https://example.com/executive-updated.jpg");
    assert.equal(body.data.employee.role.name, "OUTSIDE_SALES");
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
});

test("EXECUTIVE cannot update email, password, role, or active status", async () => {
    const passwordHashBefore = users[2].passwordHash;
    const updates = [
        { email: "changed@example.com" },
        { password: "new-secure-password" },
        { role: "OUTSIDE_SALES" },
        { isActive: false },
    ];
    const responses = await Promise.all(updates.map((body) => request("/employees/3", users[1], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })));
    const statusChange = await request("/employees/3/status", users[1], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
    });

    assert.deepEqual(responses.map((response) => response.status), [403, 403, 403, 403]);
    assert.equal(statusChange.status, 403);
    assert.equal(users[2].email, "inside@example.com");
    assert.equal(users[2].role.name, "OUTSIDE_SALES");
    assert.equal(users[2].passwordHash, passwordHashBefore);
    assert.equal(users[2].isActive, true);
});

test("INSIDE_SALES and OUTSIDE_SALES cannot use employee management endpoints", async () => {
    const operations = [
        request("/employees", users[2]),
        request("/employees/1", users[2]),
        request("/employees", users[5], {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: "Denied", email: "denied@example.com", password: "secure-password", role: "INSIDE_SALES" }),
        }),
        request("/employees/1", users[5], {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: "Denied" }),
        }),
    ];
    const responses = await Promise.all(operations);

    assert.deepEqual(responses.map((response) => response.status), [403, 403, 403, 403]);
});

test("permanent assignments block Inside Sales deactivation and role changes", async () => {
    const employee = users[2];
    employee.roleId = roles[2].id;
    employee.role = roles[2];
    employee.isActive = true;
    assignments.push({ insideSalesEmployeeId: employee.id });

    const deactivation = await request(`/employees/${employee.id}/status`, users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
    });
    const roleChange = await request(`/employees/${employee.id}`, users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "OUTSIDE_SALES" }),
    });
    const deactivationBody = await deactivation.json();
    const roleChangeBody = await roleChange.json();

    assert.equal(deactivation.status, 409);
    assert.match(deactivationBody.message, /permanent customer assignments/i);
    assert.equal(roleChange.status, 409);
    assert.match(roleChangeBody.message, /permanent customer assignments/i);
    assert.equal(employee.isActive, true);
    assert.equal(employee.role.name, "INSIDE_SALES");
});

test("ADMIN can deactivate and change the role of an unassigned Inside Sales employee", async () => {
    const employee = users[2];
    assignments.splice(0, assignments.length);
    employee.roleId = roles[2].id;
    employee.role = roles[2];
    employee.isActive = true;

    const deactivation = await request(`/employees/${employee.id}/status`, users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
    });
    const roleChange = await request(`/employees/${employee.id}`, users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "OUTSIDE_SALES" }),
    });
    const deactivationBody = await deactivation.json();
    const roleChangeBody = await roleChange.json();

    assert.equal(deactivation.status, 200);
    assert.equal(deactivationBody.data.employee.isActive, false);
    assert.equal(roleChange.status, 200);
    assert.equal(roleChangeBody.data.employee.role.name, "OUTSIDE_SALES");
});

test("Executive employee endpoints reuse employee validation and reject other roles", async () => {
    const listed = await requestExecutive("/employees", users[1]);
    const created = await requestExecutive("/employees", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Executive Route Employee",
            email: "executive-route-employee@example.com",
            password: "secure-password",
            role: "INSIDE_SALES",
        }),
    });
    const forbiddenRole = await requestExecutive("/employees", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Forbidden Executive Route Employee",
            email: "forbidden-executive-route@example.com",
            password: "secure-password",
            role: "ADMIN",
        }),
    });
    const insideSales = await requestExecutive("/employees", users[5]);
    const outsideSales = await requestExecutive("/employees", users[4]);

    assert.equal(listed.status, 200);
    assert.equal(created.status, 201);
    assert.equal(forbiddenRole.status, 403);
    assert.equal(insideSales.status, 403);
    assert.equal(outsideSales.status, 403);
    assert.equal(JSON.stringify(await created.json()).includes("passwordHash"), false);
});
