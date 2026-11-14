import assert from "node:assert/strict";
import test from "node:test";
import { createAttendanceController } from "../src/controllers/attendanceController.js";

function response() {
    return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

const user = { id: 7, role: "INSIDE_SALES" };
const office = { id: 3, officeName: "HQ", address: "Main Street" };
function record(overrides = {}) {
    return { id: 11, employeeId: user.id, officeLocationId: office.id, loginTime: new Date("2026-11-12T09:00:00.000Z"), logoutTime: null, loginLatitude: 12.9, loginLongitude: 77.5, logoutLatitude: null, logoutLongitude: null, status: "LOGGED_IN", logoutReason: null, employee: { id: 7, fullName: "Ada", email: "ada@example.test", role: { name: "INSIDE_SALES" } }, officeLocation: office, ...overrides };
}

test("check-in uses the authenticated employee and server time", async () => {
    let created;
    const controller = createAttendanceController({
        now: () => new Date("2026-11-12T09:05:00.000Z"),
        prismaClient: {
            officeLocation: { findFirst: async () => ({ id: office.id }) },
            attendance: { create: async ({ data }) => { created = data; return record({ loginTime: data.loginTime }); } },
        },
    });
    const res = response();
    await controller.checkIn({ user, body: { latitude: 12.9, longitude: 77.5, officeLocationId: 3 } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(created.employeeId, user.id);
    assert.equal(created.loginTime.toISOString(), "2026-11-12T09:05:00.000Z");
    assert.equal(res.body.data.attendance.workingDurationMinutes, null);
});

test("check-in rejects spoofed employee IDs, bad coordinates, and duplicate sessions", async () => {
    const controller = createAttendanceController({
        prismaClient: {
            officeLocation: { findFirst: async () => ({ id: office.id }) },
            attendance: { create: async () => { const error = new Error(); error.code = "P2002"; throw error; } },
        },
    });
    await assert.rejects(() => controller.checkIn({ user, body: { employeeId: 99, latitude: 12, longitude: 77, officeLocationId: 3 } }, response()), { statusCode: 400 });
    await assert.rejects(() => controller.checkIn({ user, body: { latitude: 91, longitude: 77, officeLocationId: 3 } }, response()), { statusCode: 400 });
    await assert.rejects(() => controller.checkIn({ user, body: { latitude: 12, longitude: 77, officeLocationId: 3 } }, response()), { statusCode: 409 });
});

test("checkout is conditional, server timed, and returns working duration", async () => {
    let update;
    const checkedOut = record({ status: "LOGGED_OUT", logoutTime: new Date("2026-11-12T17:31:00.000Z"), logoutLatitude: 12.8, logoutLongitude: 77.6, logoutReason: "MANUAL" });
    const controller = createAttendanceController({
        now: () => new Date("2026-11-12T17:31:00.000Z"),
        prismaClient: {
            attendance: {
                findFirst: async () => ({ id: 11 }),
                updateMany: async (value) => { update = value; return { count: 1 }; },
                findUnique: async () => checkedOut,
            },
        },
    });
    const res = response();
    await controller.checkOut({ user, body: { latitude: 12.8, longitude: 77.6 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(update.where.employeeId, user.id);
    assert.equal(update.data.logoutTime.toISOString(), "2026-11-12T17:31:00.000Z");
    assert.equal(res.body.data.attendance.workingDurationMinutes, 511);
});

test("checkout rejects absent or concurrently closed active attendance", async () => {
    const absent = createAttendanceController({ prismaClient: { attendance: { findFirst: async () => null } } });
    await assert.rejects(() => absent.checkOut({ user, body: { latitude: 12, longitude: 77 } }, response()), { statusCode: 409 });
    const race = createAttendanceController({ prismaClient: { attendance: { findFirst: async () => ({ id: 11 }), updateMany: async () => ({ count: 0 }) } } });
    await assert.rejects(() => race.checkOut({ user, body: { latitude: 12, longitude: 77 } }, response()), { statusCode: 409 });
});

test("daily self attendance reports not checked in without exposing another employee", async () => {
    const controller = createAttendanceController({ prismaClient: { attendance: { findMany: async ({ where }) => { assert.equal(where.employeeId, user.id); return []; } } } });
    const res = response();
    await controller.myAttendanceForDate({ user, params: { date: "2026-11-12" } }, res);
    assert.equal(res.body.data.status, "NOT_CHECKED_IN");
});
