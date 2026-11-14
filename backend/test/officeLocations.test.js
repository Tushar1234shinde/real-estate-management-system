import assert from "node:assert/strict";
import { test } from "node:test";
import { createOfficeLocationController } from "../src/controllers/officeLocationController.js";

function response() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

const adminUser = { id: 1, role: "ADMIN" };
const employeeUser = { id: 2, role: "INSIDE_SALES" };
const office = { id: 3, officeName: "HQ", address: "Main Street", latitude: 12.9, longitude: 77.5, allowedRadiusMeters: 200, isActive: true };

test("listOfficeLocations returns all offices with pagination", async () => {
    const offices = [office];
    let captured;
    const controller = createOfficeLocationController({
        prismaClient: {
            officeLocation: {
                findMany: async ({ skip, take }) => {
                    captured = { skip, take };
                    return offices.slice(skip, skip + take).map((o) => ({ ...o }));
                },
                count: async () => offices.length,
            },
            $transaction: async (ops) => Promise.all(ops),
        },
    });
    const res = response();
    await controller.listOfficeLocations({ user: adminUser, query: { page: "1", pageSize: "10" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.officeLocations.length, 1);
    assert.equal(res.body.data.pagination.total, 1);
});

test("createOfficeLocation creates a new office", async () => {
    let created;
    const controller = createOfficeLocationController({
        prismaClient: {
            officeLocation: {
                create: async ({ data }) => { created = data; return { ...office, ...data, id: 3 }; },
            },
        },
    });
    const res = response();
    await controller.createOfficeLocation({
        user: adminUser,
        body: { officeName: "Branch Office", address: "Branch Ave", latitude: 13.1, longitude: 77.7, allowedRadiusMeters: 300 },
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(created.officeName, "Branch Office");
    assert.equal(created.latitude, 13.1);
    assert.equal(created.longitude, 77.7);
    assert.equal(created.isActive, true);
});

test("createOfficeLocation rejects empty officeName", async () => {
    const controller = createOfficeLocationController({ prismaClient: {} });
    const res = response();
    await assert.rejects(
        () => controller.createOfficeLocation({ user: adminUser, body: { officeName: "" } }, res),
        { statusCode: 400 }
    );
});

test("createOfficeLocation rejects invalid latitude", async () => {
    const controller = createOfficeLocationController({ prismaClient: {} });
    const res = response();
    await assert.rejects(
        () => controller.createOfficeLocation({ user: adminUser, body: { officeName: "Test", latitude: 91, longitude: 77 } }, res),
        { statusCode: 400 }
    );
});

test("createOfficeLocation rejects invalid longitude", async () => {
    const controller = createOfficeLocationController({ prismaClient: {} });
    const res = response();
    await assert.rejects(
        () => controller.createOfficeLocation({ user: adminUser, body: { officeName: "Test", latitude: 12, longitude: 181 } }, res),
        { statusCode: 400 }
    );
});

test("updateOfficeLocation updates an existing office", async () => {
    let updated;
    const controller = createOfficeLocationController({
        prismaClient: {
            officeLocation: {
                update: async ({ where, data }) => {
                    updated = { where, data };
                    return { ...office, ...data, id: where.id };
                },
            },
        },
    });
    const res = response();
    await controller.updateOfficeLocation({
        user: adminUser,
        params: { id: "3" },
        body: { officeName: "HQ Updated", isActive: false },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(updated.where.id, 3);
    assert.equal(updated.data.officeName, "HQ Updated");
    assert.equal(updated.data.isActive, false);
});
test("toggleOfficeLocationStatus flips isActive", async () => {
    let toggled;
    const controller = createOfficeLocationController({
        prismaClient: {
            officeLocation: {
                findUnique: async () => ({ id: 3, isActive: true }),
                update: async ({ where, data }) => {
                    toggled = { where, data };
                    return { ...office, isActive: data.isActive, id: where.id };
                },
            },
        },
    });
    const res = response();
    await controller.toggleOfficeLocationStatus({ user: adminUser, params: { id: "3" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(toggled.where.id, 3);
    assert.equal(toggled.data.isActive, false);
});

test("toggleOfficeLocationStatus rejects non-existent office", async () => {
    const controller = createOfficeLocationController({
        prismaClient: {
            officeLocation: {
                findUnique: async () => null,
            },
        },
    });
    const res = response();
    await assert.rejects(
        () => controller.toggleOfficeLocationStatus({ user: adminUser, params: { id: "999" } }, res),
        { statusCode: 404 }
    );
});

test("updateOfficeLocation rejects empty officeName", async () => {
    const controller = createOfficeLocationController({ prismaClient: {} });
    const res = response();
    await assert.rejects(
        () => controller.updateOfficeLocation({ user: adminUser, params: { id: "3" }, body: { officeName: "" } }, res),
        { statusCode: 400 }
    );
});

