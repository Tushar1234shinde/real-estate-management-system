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
    { id: 3, fullName: "Inside User", email: "inside@example.com", isActive: true, role: { name: "INSIDE_SALES" }, passwordHash: "secret" },
    { id: 4, fullName: "Inactive Inside User", email: "inactive@example.com", isActive: false, role: { name: "INSIDE_SALES" } },
    { id: 5, fullName: "Outside User", email: "outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
];
const customers = [
    {
        id: 11, fullName: "Assigned Customer", email: "assigned@example.com", phone: "1111111111", address: "Central",
        status: "ASSIGNED", interestStatus: "INTERESTED", createdAt: new Date("2026-11-10T10:00:00Z"), updatedAt: new Date(),
        assignment: { id: 1, insideSalesEmployeeId: 3, assignedAt: new Date("2026-11-10T10:00:00Z"), status: "ASSIGNED", assignedByUserId: 1 },
        calls: [{ id: 1 }], internalNote: "must not be returned",
    },
    {
        id: 12, fullName: "Unassigned Customer", email: null, phone: "2222222222", address: null,
        status: "NEW", interestStatus: "PENDING", createdAt: new Date("2026-11-11T10:00:00Z"), updatedAt: new Date(), assignment: null,
    },
];
const assignmentCustomers = [
    {
        id: 14, fullName: "Assignment Customer", email: "assignment@example.com", phone: "3333333333", address: "South",
        status: "NEW", interestStatus: "PENDING", createdAt: new Date("2026-11-12T10:00:00Z"), updatedAt: new Date(), assignment: null,
        internalNote: "private",
    },
    {
        id: 15, fullName: "Concurrent Customer", email: "concurrent@example.com", phone: "4444444444", address: null,
        status: "NEW", interestStatus: "PENDING", createdAt: new Date("2026-11-13T10:00:00Z"), updatedAt: new Date(), assignment: null,
    },
];
let nextCustomerId = 13;

function findCustomer(id) {
    return customers.find((customer) => customer.id === id)
        ?? assignmentCustomers.find((customer) => customer.id === id);
}

function safeCustomer(customer) {
    if (!customer) return null;
    return {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        status: customer.status,
        interestStatus: customer.interestStatus,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        assignment: customer.assignment && {
            id: customer.assignment.id,
            insideSalesEmployeeId: customer.assignment.insideSalesEmployeeId,
            assignedAt: customer.assignment.assignedAt,
            status: customer.assignment.status,
        },
    };
}

function matchesWhere(customer, where) {
    return (where.id === undefined || customer.id === where.id)
        && (where.status === undefined || customer.status === where.status)
        && (where.interestStatus === undefined || customer.interestStatus === where.interestStatus);
}

const prismaClient = {
    user: {
        async findUnique({ where }) { return users.find((user) => user.id === where.id) ?? null; },
        async findFirst({ where }) {
            return users.find((user) => user.id === where.id
                && user.isActive === where.isActive
                && user.role.name === where.role.name) ?? null;
        },
    },
    customer: {
        async findMany({ where, skip, take }) {
            return customers
                .filter((customer) => matchesWhere(customer, where))
                .sort((left, right) => right.createdAt - left.createdAt || left.id - right.id)
                .slice(skip, skip + take)
                .map(safeCustomer);
        },
        async count({ where }) { return customers.filter((customer) => matchesWhere(customer, where)).length; },
        async findUnique({ where, select }) {
            const customer = findCustomer(where.id);
            if (!customer) return null;
            if (select?.assignment?.select?.customer) {
                return {
                    ...safeCustomer(customer),
                    assignment: customer.assignment && {
                        ...customer.assignment,
                        customer: {
                            id: customer.id,
                            fullName: customer.fullName,
                            email: customer.email,
                            phone: customer.phone,
                            address: customer.address,
                            status: customer.status,
                            interestStatus: customer.interestStatus,
                        },
                        insideSalesEmployee: users.find((user) => user.id === customer.assignment.insideSalesEmployeeId),
                        assignedBy: users.find((user) => user.id === customer.assignment.assignedByUserId),
                    },
                };
            }
            if (select?.assignment && Object.keys(select.assignment.select ?? {}).length === 1) {
                return { id: customer.id, assignment: customer.assignment ? { id: customer.assignment.id } : null };
            }
            return safeCustomer(customer);
        },
        async create({ data }) {
            const customer = { id: nextCustomerId, ...data, createdAt: new Date(), updatedAt: new Date(), assignment: null };
            nextCustomerId += 1;
            customers.push(customer);
            return safeCustomer(customer);
        },
        async update({ where, data }) {
            const customer = findCustomer(where.id);
            Object.assign(customer, data, { updatedAt: new Date() });
            return safeCustomer(customer);
        },
    },
    customerAssignment: {
        async create({ data }) {
            const customer = findCustomer(data.customerId);
            if (customer.assignment) {
                const error = new Error("Unique constraint failed.");
                error.code = "P2002";
                throw error;
            }
            const assignment = {
                id: data.customerId,
                ...data,
                status: "ASSIGNED",
                assignedAt: new Date(),
            };
            customer.assignment = assignment;
            return {
                ...assignment,
                customer: {
                    id: customer.id,
                    fullName: customer.fullName,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    status: customer.status,
                    interestStatus: customer.interestStatus,
                },
                insideSalesEmployee: users.find((user) => user.id === data.insideSalesEmployeeId),
                assignedBy: users.find((user) => user.id === data.assignedByUserId),
            };
        },
    },
    async $transaction(operations) {
        if (typeof operations === "function") return operations(prismaClient);
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

test("allows ADMIN and EXECUTIVE to list all customers with pagination and filters", async () => {
    const all = await request("/customers?page=1&pageSize=1", users[0]);
    const filtered = await request("/customers?status=ASSIGNED&interestStatus=INTERESTED", users[1]);
    const allBody = await all.json();
    const filteredBody = await filtered.json();

    assert.equal(all.status, 200);
    assert.deepEqual(allBody.data.customers.map((customer) => customer.id), [12]);
    assert.deepEqual(allBody.data.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
    assert.equal(filtered.status, 200);
    assert.deepEqual(filteredBody.data.customers.map((customer) => customer.id), [11]);
});

test("denies customer management to non-admin roles and rejects invalid list filters", async () => {
    const forbidden = await request("/customers", users[2]);
    const invalidStatus = await request("/customers?status=UNKNOWN", users[0]);
    const invalidPagination = await request("/customers?page=0", users[0]);

    assert.equal(forbidden.status, 403);
    assert.equal(invalidStatus.status, 400);
    assert.equal(invalidPagination.status, 400);
});

test("creates an unassigned customer with valid enums and safe response", async () => {
    const response = await request("/customers", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "New Customer",
            phone: "+919999999999",
            email: "new@example.com",
            address: "  New address  ",
            status: "NEW",
            interestStatus: "PENDING",
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.customer.assignment, null);
    assert.equal(body.data.customer.address, "New address");
    assert.equal("calls" in body.data.customer, false);
    assert.equal("internalNote" in body.data.customer, false);
});

test("rejects creating a customer with ASSIGNED status without an assignment", async () => {
    const response = await request("/customers", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Unassigned State", phone: "5555555555", status: "ASSIGNED" }),
    });

    assert.equal(response.status, 400);
    assert.equal(customers.some((customer) => customer.fullName === "Unassigned State"), false);
});

test("does not impose a duplicate rule absent from the Customer schema", async () => {
    const response = await request("/customers", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Same Phone", phone: "1111111111" }),
    });

    assert.equal(response.status, 201);
});

test("returns global customer details with only explicit safe fields", async () => {
    const response = await request("/customers/11", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.customer.assignment.insideSalesEmployeeId, 3);
    assert.equal(JSON.stringify(body).includes("assignedByUserId"), false);
    assert.equal(JSON.stringify(body).includes("internalNote"), false);
});

test("updates editable customer fields but rejects reassignment and invalid inputs", async () => {
    const updated = await request("/customers/11", users[1], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Updated Customer", email: "updated@example.com", status: "CONTACTED", interestStatus: "INTERESTED" }),
    });
    const reassignment = await request("/customers/11", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ insideSalesEmployeeId: 99 }),
    });
    const invalid = await request("/customers/12", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "not-a-phone", interestStatus: "MAYBE" }),
    });

    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.customer.status, "CONTACTED");
    assert.equal(reassignment.status, 400);
    assert.equal(invalid.status, 400);
});

test("rejects setting an unassigned customer status to ASSIGNED", async () => {
    const response = await request("/customers/12", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ASSIGNED" }),
    });

    assert.equal(response.status, 409);
    assert.equal(findCustomer(12).status, "NEW");
    assert.equal(findCustomer(12).assignment, null);
});

test("prevents status changes from contradicting an existing assignment", async () => {
    const assignedToNew = await request("/customers/11", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NEW" }),
    });
    const unassignedToContacted = await request("/customers/12", users[0], {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONTACTED" }),
    });

    assert.equal(assignedToNew.status, 409);
    assert.equal(unassignedToContacted.status, 409);
    assert.equal(findCustomer(11).status, "CONTACTED");
    assert.equal(findCustomer(12).status, "NEW");
});

test("rejects invalid create bodies and missing or invalid customer identifiers", async () => {
    const invalidCreate = await request("/customers", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "", phone: "bad", status: "INVALID" }),
    });
    const missing = await request("/customers/999", users[0]);
    const invalidId = await request("/customers/not-an-id", users[0]);
    const invalidEmail = await request("/customers", users[0], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "Valid Name", phone: "3333333333", email: "not-an-email" }),
    });
    const emptyPatch = await request("/customers/11", users[0], {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });

    assert.equal(invalidCreate.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(invalidId.status, 400);
    assert.equal(invalidEmail.status, 400);
    assert.equal(emptyPatch.status, 400);
});

test("reads assignment details only for an existing customer with a safe response", async () => {
    const assigned = await request("/customers/11/assignment", users[0]);
    const unassigned = await request("/customers/14/assignment", users[1]);
    const missing = await request("/customers/999/assignment", users[0]);
    const assignedBody = await assigned.json();
    const unassignedBody = await unassigned.json();

    assert.equal(assigned.status, 200);
    assert.equal(assignedBody.data.assignment.customer.id, 11);
    assert.deepEqual(assignedBody.data.assignment.insideSalesEmployee, {
        id: 3, fullName: "Inside User", email: "inside@example.com",
    });
    assert.equal(JSON.stringify(assignedBody).includes("passwordHash"), false);
    assert.equal(JSON.stringify(assignedBody).includes("internalNote"), false);
    assert.equal(unassigned.status, 200);
    assert.equal(unassignedBody.data.assignment, null);
    assert.equal(missing.status, 404);
});

test("assigns an unassigned customer to an active Inside Sales employee using the authenticated user", async () => {
    const response = await request("/customers/14/assignment", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insideSalesEmployeeId: 3 }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.assignment.customerId, 14);
    assert.equal(body.data.assignment.assignedByUserId, users[1].id);
    assert.equal(body.data.assignment.insideSalesEmployee.id, 3);
    assert.equal(body.data.assignment.customer.status, "ASSIGNED");
    assert.ok(body.data.assignment.assignedAt);
    assert.equal(findCustomer(14).status, "ASSIGNED");
    assert.ok(findCustomer(14).assignment);
    assert.equal(JSON.stringify(body).includes("passwordHash"), false);
    assert.equal(JSON.stringify(body).includes("internalNote"), false);
});

test("rejects assignments for missing customers, invalid employees, and reassignment", async () => {
    const assign = (customerId, insideSalesEmployeeId, extra = {}) => request(`/customers/${customerId}/assignment`, users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insideSalesEmployeeId, ...extra }),
    });
    const missingCustomer = await assign(999, 3);
    const invalidEmployee = await assign(15, 999);
    const inactiveEmployee = await assign(15, 4);
    const wrongRole = await assign(15, 5);
    const alreadyAssigned = await assign(11, 3);
    const spoofedAssigner = await assign(15, 3, { assignedByUserId: 2 });

    assert.equal(missingCustomer.status, 404);
    assert.equal(invalidEmployee.status, 400);
    assert.equal(inactiveEmployee.status, 400);
    assert.equal(wrongRole.status, 400);
    assert.equal(alreadyAssigned.status, 409);
    assert.equal(spoofedAssigner.status, 400);
});

test("restricts assignment endpoints to ADMIN and EXECUTIVE", async () => {
    const unauthenticatedGet = await fetch(`${baseUrl}/api/admin/customers/14/assignment`);
    const unauthenticatedPost = await fetch(`${baseUrl}/api/admin/customers/14/assignment`, { method: "POST" });
    const forbiddenGet = await request("/customers/14/assignment", users[2]);
    const forbiddenPost = await request("/customers/14/assignment", users[2], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insideSalesEmployeeId: 3 }),
    });

    assert.equal(unauthenticatedGet.status, 401);
    assert.equal(unauthenticatedPost.status, 401);
    assert.equal(forbiddenGet.status, 403);
    assert.equal(forbiddenPost.status, 403);
});

test("returns one success and one conflict for concurrent assignment attempts", async () => {
    const makeRequest = () => request("/customers/15/assignment", users[0], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insideSalesEmployeeId: 3 }),
    });
    const responses = await Promise.all([makeRequest(), makeRequest()]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(findCustomer(15).status, "ASSIGNED");
    assert.ok(findCustomer(15).assignment);
});

test("Executive customer endpoints reuse validation, assignment rules, and role restrictions", async () => {
    const listed = await requestExecutive("/customers?page=1&pageSize=10", users[1]);
    const created = await requestExecutive("/customers", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fullName: "Executive Route Customer",
            phone: "5555555555",
            email: "executive-route-customer@example.com",
        }),
    });
    const customerBody = await created.json();
    const customerId = customerBody.data.customer.id;
    const invalidEmployee = await requestExecutive("/assignments", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, insideSalesEmployeeId: 999 }),
    });
    const assignment = await requestExecutive("/assignments", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, insideSalesEmployeeId: 3 }),
    });
    const assignmentBody = await assignment.json();
    const reassignment = await requestExecutive("/assignments", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, insideSalesEmployeeId: 3 }),
    });
    const invalidBody = await requestExecutive("/assignments", users[1], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: "not-an-id", insideSalesEmployeeId: 3 }),
    });
    const insideSales = await requestExecutive("/customers", users[2]);
    const outsideSales = await requestExecutive("/assignments", users[4], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: 15, insideSalesEmployeeId: 3 }),
    });
    const forbiddenOperations = [
        ["/employees", {}],
        ["/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "Forbidden",
                email: "forbidden-executive-route@example.com",
                password: "secure-password",
                role: "INSIDE_SALES",
            }),
        }],
        ["/customers", {}],
        ["/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName: "Forbidden", phone: "6666666666" }),
        }],
        ["/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId: 15, insideSalesEmployeeId: 3 }),
        }],
    ];
    const forbiddenResponses = await Promise.all(
        [users[2], users[4]].flatMap((user) =>
            forbiddenOperations.map(([path, options]) => requestExecutive(path, user, options))),
    );

    assert.equal(listed.status, 200);
    assert.equal(created.status, 201);
    assert.equal(assignment.status, 201);
    assert.equal(assignmentBody.data.assignment.customerId, customerId);
    assert.equal(assignmentBody.data.assignment.assignedByUserId, users[1].id);
    assert.equal(assignmentBody.data.assignment.customer.status, "ASSIGNED");
    assert.equal(reassignment.status, 409);
    assert.equal(invalidEmployee.status, 400);
    assert.equal(invalidBody.status, 400);
    assert.equal(insideSales.status, 403);
    assert.equal(outsideSales.status, 403);
    assert.deepEqual(forbiddenResponses.map((response) => response.status), Array(10).fill(403));
    assert.equal(JSON.stringify(assignmentBody).includes("passwordHash"), false);
    assert.equal(findCustomer(customerId).status, "ASSIGNED");
    assert.ok(findCustomer(customerId).assignment);
});
