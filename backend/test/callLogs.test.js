import assert from "node:assert/strict";
import test from "node:test";
import { createCallLogController } from "../src/controllers/callLogController.js";

function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const outside = { id: 7, role: "OUTSIDE_SALES" };

test("creates an Outside Sales call log with JWT employee identity", async () => {
    let data;
    const controller = createCallLogController({ prismaClient: {
        customer: { findFirst: async () => ({ id: 10 }) },
        callLog: { create: async (input) => { data = input.data; return { id: 1, ...input.data, customer: {}, employee: {}, property: null }; } },
    } });
    const res = response();
    await controller.createOwnCustomerLog({ user: outside, params: { customerId: "10" }, body: { outcome: "INTERESTED", notes: "  Called  " } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(data.employeeId, outside.id);
    assert.equal(data.customerId, 10);
    assert.equal(data.notes, "Called");
});

test("masks nested customer phone numbers in sales call-log responses", async () => {
    const callLog = {
        id: 1,
        customer: { id: 10, fullName: "Customer", phone: "+919876543210" },
        employee: {},
        property: null,
    };
    const controller = createCallLogController({ prismaClient: {
        customer: { findFirst: async () => ({ id: 10 }) },
        callLog: {
            findMany: async () => [callLog],
            create: async () => callLog,
        },
    } });

    const listed = response();
    await controller.listOwnCustomerLogs({ user: outside, params: { customerId: "10" } }, listed);
    assert.equal(listed.body.data.callLogs[0].customer.phone, "****3210");

    const created = response();
    await controller.createOwnCustomerLog({ user: outside, params: { customerId: "10" }, body: { outcome: "INTERESTED" } }, created);
    assert.equal(created.body.data.callLog.customer.phone, "****3210");
});

test("rejects employee spoofing and invalid call payloads", async () => {
    const controller = createCallLogController({ prismaClient: {} });
    await assert.rejects(() => controller.createOwnCustomerLog({ user: outside, params: { customerId: "10" }, body: { employeeId: 99, outcome: "INTERESTED" } }, response()), { statusCode: 400 });
    await assert.rejects(() => controller.createOwnCustomerLog({ user: outside, params: { customerId: "10" }, body: { outcome: "OTHER" } }, response()), { statusCode: 400 });
});

test("admin filters include role and date range", async () => {
    let where;
    const controller = createCallLogController({ prismaClient: { $transaction: async (items) => Promise.all(items), callLog: { findMany: async (input) => { where = input.where; return []; }, count: async () => 0 } } });
    const res = response();
    await controller.listOrganizationLogs({ query: { role: "OUTSIDE_SALES", outcome: "NO_ANSWER", from: "2026-11-01", to: "2026-11-02" } }, res);
    assert.equal(where.employee.role.name, "OUTSIDE_SALES");
    assert.equal(where.outcome, "NO_ANSWER");
    assert.ok(where.calledAt.gte instanceof Date);
});
