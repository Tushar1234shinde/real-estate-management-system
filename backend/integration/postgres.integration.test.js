import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createIntegrationPrisma, requireTestDatabaseUrl } from "./support/testDatabase.js";

const enabled = process.env.TEST_DATABASE_URL !== undefined || process.env.INTEGRATION_TESTS_ENABLED === "true";

if (!enabled) {
    test("PostgreSQL integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
    const testDatabaseUrl = requireTestDatabaseUrl();
    const primaryDatabaseUrl = new URL(testDatabaseUrl);
    primaryDatabaseUrl.searchParams.set("application_name", "integration-primary");
    const secondaryDatabaseUrl = new URL(testDatabaseUrl);
    secondaryDatabaseUrl.searchParams.set("application_name", "integration-secondary");
    const prisma = createIntegrationPrisma(primaryDatabaseUrl.toString());
    const secondPrisma = createIntegrationPrisma(secondaryDatabaseUrl.toString());
    process.env.DATABASE_URL = testDatabaseUrl;

    const [{ createApp }, { createVisitSubmissionController }, { createAdminVisitReviewController }] = await Promise.all([
        import("../src/app.js"),
        import("../src/controllers/visitSubmissionController.js"),
        import("../src/controllers/adminVisitReviewController.js"),
    ]);
    const jwtConfig = {
        secret: crypto.randomBytes(32).toString("base64url"),
        expiresIn: "1h",
        issuer: "integration-real-estate-api",
        audience: "integration-real-estate-client",
    };
    const runId = `integration-${crypto.randomUUID()}`;
    const tracked = { users: [], customers: [], properties: [], schedules: [], visits: [], attendance: [], offices: [], announcements: [], callLogs: [] };
    const roles = {};
    let cloudinaryUploadGate = null;
    const destroyedCloudinaryAssets = [];
    let server;
    let secondServer;
    let baseUrl;
    let secondBaseUrl;

    const cloudinaryClient = {
        uploader: {
            upload_stream(options, callback) {
                return {
                    end(buffer) {
                        const result = {
                            public_id: options.public_id,
                            asset_id: `asset-${options.public_id}`,
                            resource_type: options.resource_type,
                            type: options.type,
                            secure_url: `https://example.invalid/${options.public_id}`,
                            bytes: buffer.length,
                            duration: 1,
                        };
                        if (cloudinaryUploadGate) {
                            const gate = cloudinaryUploadGate;
                            cloudinaryUploadGate = null;
                            gate.started();
                            gate.wait.then(() => callback(null, result));
                            return;
                        }
                        callback(null, result);
                    },
                };
            },
            async destroy(publicId) {
                destroyedCloudinaryAssets.push(publicId);
                return { result: "ok" };
            },
        },
    };

    function tokenFor(user) {
        return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        });
    }

    async function start(app) {
        const listening = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });
        return { server: listening, baseUrl: `http://127.0.0.1:${listening.address().port}` };
    }

    async function request(url, path, user, options = {}) {
        return fetch(`${url}${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
        });
    }

    async function runConcurrentRequests(requestFactories) {
        let releaseRequests;
        let markReady;
        let readyCount = 0;
        const requestGate = new Promise((resolve) => { releaseRequests = resolve; });
        const allReady = new Promise((resolve) => { markReady = resolve; });
        const pending = requestFactories.map(async (factory) => {
            readyCount += 1;
            if (readyCount === requestFactories.length) markReady();
            await requestGate;
            return factory();
        });

        await allReady;
        releaseRequests();
        return Promise.all(pending);
    }

    async function cleanupTrackedRecords() {
        if (tracked.callLogs.length) await prisma.callLog.deleteMany({ where: { id: { in: tracked.callLogs } } });
        if (tracked.announcements.length) await prisma.announcement.deleteMany({ where: { id: { in: tracked.announcements } } });
        if (tracked.attendance.length) await prisma.attendance.deleteMany({ where: { id: { in: tracked.attendance } } });
        if (tracked.visits.length) {
            await prisma.visitStatusHistory.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.mediaAsset.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.visit.deleteMany({ where: { id: { in: tracked.visits } } });
        }
        if (tracked.schedules.length) await prisma.visitSchedule.deleteMany({ where: { id: { in: tracked.schedules } } });
        if (tracked.customers.length) await prisma.customerAssignment.deleteMany({ where: { customerId: { in: tracked.customers } } });
        if (tracked.customers.length) await prisma.customer.deleteMany({ where: { id: { in: tracked.customers } } });
        if (tracked.properties.length) await prisma.property.deleteMany({ where: { id: { in: tracked.properties } } });
        if (tracked.offices.length) await prisma.officeLocation.deleteMany({ where: { id: { in: tracked.offices } } });
        if (tracked.users.length) await prisma.user.deleteMany({ where: { id: { in: tracked.users } } });
        Object.values(tracked).forEach((items) => items.splice(0));
    }

    async function fixture({ status = "IN_PROGRESS", verificationResult = "PENDING", withVisit = true } = {}) {
        const nonce = `${runId}-${crypto.randomUUID()}`;
        const createUser = async (roleName, label) => {
            const user = await prisma.user.create({
                data: {
                    roleId: roles[roleName].id,
                    fullName: `${label} ${nonce}`,
                    email: `${label}-${nonce}@integration.test`,
                    passwordHash: "integration-test-hash",
                },
            });
            tracked.users.push(user.id);
            return user;
        };
        const admin = await createUser("ADMIN", "admin");
        const executive = await createUser("EXECUTIVE", "executive");
        const inside = await createUser("INSIDE_SALES", "inside");
        const outside = await createUser("OUTSIDE_SALES", "outside");
        const customer = await prisma.customer.create({
            data: { fullName: "Integration Customer", phone: `9${crypto.randomInt(10 ** 9, 10 ** 10 - 1)}` },
        });
        tracked.customers.push(customer.id);
        const property = await prisma.property.create({
            data: {
                title: "Integration Property",
                location: "Integration Location",
                latitude: 12.9716,
                longitude: 77.5946,
                verificationRadiusMeters: 200,
                price: "100000.00",
            },
        });
        tracked.properties.push(property.id);
        const schedule = await prisma.visitSchedule.create({
            data: {
                customerId: customer.id,
                propertyId: property.id,
                insideSalesEmployeeId: inside.id,
                outsideSalesEmployeeId: outside.id,
                scheduledByUserId: admin.id,
                scheduledAt: new Date(),
            },
        });
        tracked.schedules.push(schedule.id);
        const visit = withVisit ? await prisma.visit.create({
            data: {
                scheduleId: schedule.id,
                status,
                verificationResult,
                verificationCheckedAt: verificationResult === "PENDING" ? null : new Date(),
                reachedLatitude: verificationResult === "PENDING" ? null : 12.9716,
                reachedLongitude: verificationResult === "PENDING" ? null : 77.5946,
                verificationDistanceMeters: verificationResult === "PENDING" ? null : 0,
            },
        }) : null;
        if (visit) tracked.visits.push(visit.id);
        return { admin, executive, inside, outside, customer, property, schedule, visit };
    }

    async function addSelfie(visitId, userId) {
        return prisma.mediaAsset.create({
            data: {
                visitId,
                uploadedByUserId: userId,
                mediaType: "VISIT_SELFIE",
                fileUrl: `https://example.invalid/${crypto.randomUUID()}`,
                mimeType: "image/jpeg",
                fileSizeBytes: 123n,
            },
        });
    }

    function imageForm() {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], { type: "image/jpeg" }), "visit.jpg");
        return form;
    }

    function audioForm() {
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array([0x49, 0x44, 0x33, 0x04])], { type: "audio/mpeg" }), "visit.mp3");
        return form;
    }

    before(async () => {
        for (const name of ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]) {
            roles[name] = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
        }
        ({ server, baseUrl } = await start(createApp({ prismaClient: prisma, jwtConfig, corsOptions: { origin: false }, cloudinaryClient })));
        ({ server: secondServer, baseUrl: secondBaseUrl } = await start(createApp({ prismaClient: secondPrisma, jwtConfig, corsOptions: { origin: false }, cloudinaryClient })));
    });

    afterEach(cleanupTrackedRecords);
    after(async () => {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        await new Promise((resolve, reject) => secondServer.close((error) => (error ? reject(error) : resolve())));
        await Promise.all([prisma.$disconnect(), secondPrisma.$disconnect()]);
    });

    test("enforces real foreign-key and unique constraints", async () => {
        const data = await fixture();
        await assert.rejects(
            prisma.visit.create({ data: { scheduleId: data.schedule.id } }),
            (error) => error.code === "P2002",
        );
        await assert.rejects(
            prisma.visit.create({ data: { scheduleId: 2147483647 } }),
            (error) => error.code === "P2003",
        );
    });

    test("persists employee attendance with authenticated ownership, conditional checkout, and ADMIN reporting", async () => {
        const data = await fixture();
        const office = await prisma.officeLocation.create({
            data: { officeName: `Attendance ${runId}`, latitude: 12.9716, longitude: 77.5946 },
        });
        tracked.offices.push(office.id);
        const payload = { latitude: 12.9716, longitude: 77.5946, officeLocationId: office.id };

        assert.equal((await request(baseUrl, "/api/attendance/check-in", data.admin, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        })).status, 403);
        assert.equal((await request(baseUrl, "/api/attendance/check-in", data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, employeeId: data.admin.id }),
        })).status, 400);
        assert.equal((await request(baseUrl, "/api/attendance/check-in", data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, latitude: 91 }),
        })).status, 400);

        const checkIn = await request(baseUrl, "/api/attendance/check-in", data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        assert.equal(checkIn.status, 201);
        const attendance = (await checkIn.json()).data.attendance;
        tracked.attendance.push(attendance.id);
        assert.equal(attendance.employeeId, data.inside.id);

        const concurrent = await Promise.all([
            request(baseUrl, "/api/attendance/check-in", data.outside, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
            request(secondBaseUrl, "/api/attendance/check-in", data.outside, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
        ]);
        assert.deepEqual(concurrent.map((item) => item.status).sort(), [201, 409]);
        const concurrentBody = await concurrent.find((item) => item.status === 201).json();
        tracked.attendance.push(concurrentBody.data.attendance.id);
        assert.equal(await prisma.attendance.count({ where: { employeeId: data.outside.id } }), 1);
        const checkOut = await request(baseUrl, "/api/attendance/check-out", data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: 12.9717, longitude: 77.5947 }),
        });
        assert.equal(checkOut.status, 200);
        assert.equal((await checkOut.json()).data.attendance.status, "LOGGED_OUT");
        assert.equal((await request(baseUrl, "/api/attendance/check-out", data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: 12.9717, longitude: 77.5947 }),
        })).status, 409);
        const report = await request(baseUrl, "/api/admin/attendance?employeeId=" + data.inside.id, data.admin);
        assert.equal(report.status, 200);
        assert.equal((await report.json()).data.attendance.length, 1);
        assert.equal(await prisma.attendance.count({ where: { employeeId: data.inside.id } }), 1);
    });

    test("persists role-visible announcements and atomic read receipts", async () => {
        const data = await fixture();
        const body = { title: "Inside update", content: "Please review the latest allocation.", category: "OPERATIONS", priority: "HIGH", isPublished: true, targetRoles: ["INSIDE_SALES"] };
        const created = await request(baseUrl, "/api/announcements", data.admin, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        assert.equal(created.status, 201);
        const announcement = (await created.json()).data.announcement;
        tracked.announcements.push(announcement.id);
        assert.equal(announcement.createdBy.id, data.admin.id);
        assert.equal((await request(baseUrl, "/api/announcements", data.inside)).status, 200);
        assert.equal((await (await request(baseUrl, "/api/announcements", data.inside)).json()).data.announcements.length, 1);
        assert.equal((await (await request(baseUrl, "/api/announcements", data.outside)).json()).data.announcements.length, 0);
        assert.equal((await request(baseUrl, "/api/announcements", data.outside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })).status, 403);

        const unpublished = await request(baseUrl, "/api/announcements", data.executive, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, title: "Draft", isPublished: false }),
        });
        assert.equal(unpublished.status, 201);
        const draft = (await unpublished.json()).data.announcement;
        tracked.announcements.push(draft.id);
        assert.equal((await (await request(baseUrl, "/api/announcements", data.inside)).json()).data.announcements.length, 1);
        assert.equal((await request(baseUrl, `/api/announcements/${draft.id}`, data.executive, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: true }),
        })).status, 200);
        assert.equal((await request(baseUrl, `/api/announcements/${draft.id}`, data.admin, { method: "DELETE" })).status, 200);
        tracked.announcements.splice(tracked.announcements.indexOf(draft.id), 1);

        const expired = await prisma.announcement.create({ data: { title: "Expired", content: "Old", category: "OPERATIONS", isPublished: true, expiresAt: new Date(Date.now() - 1_000), createdById: data.admin.id, targetRoles: ["INSIDE_SALES"] } });
        tracked.announcements.push(expired.id);
        assert.equal((await (await request(baseUrl, "/api/announcements", data.inside)).json()).data.announcements.length, 1);
        const reads = await Promise.all([
            request(baseUrl, `/api/announcements/${announcement.id}/read`, data.inside, { method: "POST" }),
            request(secondBaseUrl, `/api/announcements/${announcement.id}/read`, data.inside, { method: "POST" }),
        ]);
        assert.deepEqual(reads.map((item) => item.status).sort(), [200, 201]);
        assert.equal(await prisma.announcementRead.count({ where: { announcementId: announcement.id, userId: data.inside.id } }), 1);
        const statistics = await request(baseUrl, `/api/admin/announcements/${announcement.id}/read-statistics`, data.admin);
        assert.equal(statistics.status, 200);
        assert.equal((await statistics.json()).data.readCount, 1);
        assert.equal((await request(baseUrl, `/api/admin/announcements/${announcement.id}/read-statistics`, data.executive)).status, 200);
        assert.equal((await request(baseUrl, `/api/admin/announcements/${announcement.id}/read-statistics`, data.inside)).status, 403);
    });

    test("persists assigned employee call logs and permits organization-wide filtered reporting", async () => {
        const data = await fixture();
        await prisma.customerAssignment.create({
            data: { customerId: data.customer.id, insideSalesEmployeeId: data.inside.id, assignedByUserId: data.admin.id },
        });
        const body = { outcome: "INTERESTED", notes: "Customer requested a site visit." };
        const inside = await request(baseUrl, `/api/inside-sales/customers/${data.customer.id}/call-logs`, data.inside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        assert.equal(inside.status, 201);
        tracked.callLogs.push((await inside.json()).data.callLog.id);
        assert.equal((await request(baseUrl, `/api/inside-sales/customers/${data.customer.id}/call-logs`, data.outside, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, employeeId: data.inside.id }),
        })).status, 403);
        const outsideResponses = await Promise.all([
            request(baseUrl, `/api/outside-sales/customers/${data.customer.id}/call-logs`, data.outside, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER" }) }),
            request(secondBaseUrl, `/api/outside-sales/customers/${data.customer.id}/call-logs`, data.outside, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "NO_ANSWER" }) }),
        ]);
        assert.deepEqual(outsideResponses.map((item) => item.status), [201, 201]);
        for (const response of outsideResponses) tracked.callLogs.push((await response.json()).data.callLog.id);
        assert.equal(await prisma.callLog.count({ where: { customerId: data.customer.id } }), 3);
        const listing = await request(baseUrl, `/api/admin/call-logs?customerId=${data.customer.id}&role=OUTSIDE_SALES&outcome=NO_ANSWER`, data.admin);
        assert.equal(listing.status, 200);
        assert.equal((await listing.json()).data.callLogs.length, 2);
        const statistics = await request(baseUrl, "/api/admin/call-logs/statistics", data.admin);
        assert.equal(statistics.status, 200);
        assert.equal((await statistics.json()).data.total, 3);
        assert.equal((await request(baseUrl, "/api/admin/call-logs", data.outside)).status, 403);
    });

    test("enforces PostgreSQL enum and check constraints and preserves BigInt media sizes", async () => {
        const data = await fixture({ verificationResult: "PASSED" });
        await assert.rejects(
            prisma.$executeRawUnsafe("INSERT INTO properties (title, location, price, status, \"updatedAt\") VALUES ('bad', 'bad', -1, 'AVAILABLE', NOW())"),
        );
        await assert.rejects(
            prisma.$executeRawUnsafe("UPDATE visits SET status = 'NOT_A_STATUS' WHERE id = $1", data.visit.id),
        );
        const media = await prisma.mediaAsset.create({
            data: {
                visitId: data.visit.id,
                uploadedByUserId: data.outside.id,
                mediaType: "AUDIO_RECORDING",
                fileUrl: "https://example.invalid/audio",
                fileSizeBytes: 9007199254740991n,
            },
        });
        assert.equal(media.fileSizeBytes, 9007199254740991n);
    });

    test("rolls back a real review transaction when history persistence fails", async () => {
        const data = await fixture({ status: "PENDING_REVIEW", verificationResult: "PASSED" });
        const controller = createAdminVisitReviewController({
            prismaClient: {
                $transaction: (callback) => prisma.$transaction(async (tx) => callback(new Proxy(tx, {
                    get(target, property) {
                        if (property === "visitStatusHistory") {
                            return { create: async () => { throw new Error("forced history failure"); } };
                        }
                        return target[property];
                    },
                }))),
            },
        });
        const response = { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await assert.rejects(controller.approveVisit({ params: { visitId: String(data.visit.id) }, user: data.admin }, response));
        const unchanged = await prisma.visit.findUnique({ where: { id: data.visit.id } });
        assert.equal(unchanged.status, "PENDING_REVIEW");
        const unchangedSchedule = await prisma.visitSchedule.findUnique({ where: { id: data.schedule.id } });
        assert.equal(unchangedSchedule.status, "SCHEDULED");
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: data.visit.id } }), 0);
    });

    test("enforces executable schedule status and prevents concurrent duplicate initialization", async () => {
        const data = await fixture({ withVisit: false });
        const responses = await Promise.all([
            request(baseUrl, `/api/visit-schedules/${data.schedule.id}/visit`, data.outside, { method: "POST" }),
            request(secondBaseUrl, `/api/visit-schedules/${data.schedule.id}/visit`, data.outside, { method: "POST" }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
        const visit = await prisma.visit.findUnique({ where: { scheduleId: data.schedule.id } });
        tracked.visits.push(visit.id);
        assert.equal(await prisma.visit.count({ where: { scheduleId: data.schedule.id } }), 1);

        const cancelledSchedule = await prisma.visitSchedule.create({
            data: {
                customerId: data.customer.id,
                propertyId: data.property.id,
                insideSalesEmployeeId: data.inside.id,
                outsideSalesEmployeeId: data.outside.id,
                scheduledByUserId: data.admin.id,
                scheduledAt: new Date(Date.now() + 60_000),
                status: "CANCELLED",
            },
        });
        tracked.schedules.push(cancelledSchedule.id);
        const completedSchedule = await prisma.visitSchedule.create({
            data: {
                customerId: data.customer.id,
                propertyId: data.property.id,
                insideSalesEmployeeId: data.inside.id,
                outsideSalesEmployeeId: data.outside.id,
                scheduledByUserId: data.admin.id,
                scheduledAt: new Date(Date.now() + 120_000),
                status: "COMPLETED",
            },
        });
        tracked.schedules.push(completedSchedule.id);
        assert.equal((await request(baseUrl, `/api/visit-schedules/${cancelledSchedule.id}/visit`, data.outside, { method: "POST" })).status, 409);
        assert.equal((await request(baseUrl, `/api/visit-schedules/${completedSchedule.id}/visit`, data.outside, { method: "POST" })).status, 409);
        assert.equal(await prisma.visit.count({ where: { scheduleId: cancelledSchedule.id } }), 0);
        assert.equal(await prisma.visit.count({ where: { scheduleId: completedSchedule.id } }), 0);
    });

    test("allows exactly one concurrent permanent assignment for an unassigned customer", async () => {
        const data = await fixture({ withVisit: false });
        const assignmentRequest = (url) => request(url, `/api/admin/customers/${data.customer.id}/assignment`, data.admin, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insideSalesEmployeeId: data.inside.id }),
        });
        const responses = await runConcurrentRequests([
            () => assignmentRequest(baseUrl),
            () => assignmentRequest(secondBaseUrl),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);

        const assignments = await prisma.customerAssignment.findMany({
            where: { customerId: data.customer.id },
            select: { customerId: true, insideSalesEmployeeId: true, assignedByUserId: true },
        });
        const customer = await prisma.customer.findUnique({ where: { id: data.customer.id }, select: { status: true } });
        const employee = await prisma.user.findUnique({
            where: { id: data.inside.id },
            select: { isActive: true, role: { select: { name: true } } },
        });
        assert.equal(assignments.length, 1);
        assert.equal(assignments[0].insideSalesEmployeeId, data.inside.id);
        assert.equal(assignments[0].assignedByUserId, data.admin.id);
        assert.equal(customer.status, "ASSIGNED");
        assert.equal(employee.isActive, true);
        assert.equal(employee.role.name, "INSIDE_SALES");
    });

    test("prevents customer assignment from racing with employee deactivation", async () => {
        const data = await fixture({ withVisit: false });
        const assignmentRequest = () => request(baseUrl, `/api/admin/customers/${data.customer.id}/assignment`, data.admin, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insideSalesEmployeeId: data.inside.id }),
        });
        const deactivationRequest = () => request(secondBaseUrl, `/api/admin/employees/${data.inside.id}/status`, data.admin, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
        });
        const [assignmentResponse, deactivationResponse] = await runConcurrentRequests([
            assignmentRequest,
            deactivationRequest,
        ]);

        const assignment = await prisma.customerAssignment.findUnique({ where: { customerId: data.customer.id } });
        const employee = await prisma.user.findUnique({
            where: { id: data.inside.id },
            select: { isActive: true, role: { select: { name: true } } },
        });
        assert.ok(
            (assignmentResponse.status === 201 && deactivationResponse.status === 409)
            || ([400, 409].includes(assignmentResponse.status) && deactivationResponse.status === 200),
        );
        if (assignment) {
            assert.equal(assignmentResponse.status, 201);
            assert.equal(employee.isActive, true);
            assert.equal(employee.role.name, "INSIDE_SALES");
            assert.equal(assignment.insideSalesEmployeeId, data.inside.id);
        } else {
            assert.equal(deactivationResponse.status, 200);
            assert.equal(employee.isActive, false);
        }
    });

    test("prevents customer assignment from racing with an incompatible employee role change", async () => {
        const data = await fixture({ withVisit: false });
        const assignmentRequest = () => request(baseUrl, `/api/admin/customers/${data.customer.id}/assignment`, data.admin, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ insideSalesEmployeeId: data.inside.id }),
        });
        const roleChangeRequest = () => request(secondBaseUrl, `/api/admin/employees/${data.inside.id}`, data.admin, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "OUTSIDE_SALES" }),
        });
        const [assignmentResponse, roleChangeResponse] = await runConcurrentRequests([
            assignmentRequest,
            roleChangeRequest,
        ]);

        const assignment = await prisma.customerAssignment.findUnique({ where: { customerId: data.customer.id } });
        const employee = await prisma.user.findUnique({
            where: { id: data.inside.id },
            select: { isActive: true, role: { select: { name: true } } },
        });
        assert.ok(
            (assignmentResponse.status === 201 && roleChangeResponse.status === 409)
            || ([400, 409].includes(assignmentResponse.status) && roleChangeResponse.status === 200),
        );
        if (assignment) {
            assert.equal(assignmentResponse.status, 201);
            assert.equal(employee.isActive, true);
            assert.equal(employee.role.name, "INSIDE_SALES");
            assert.equal(assignment.insideSalesEmployeeId, data.inside.id);
        } else {
            assert.equal(roleChangeResponse.status, 200);
            assert.equal(employee.role.name, "OUTSIDE_SALES");
        }
    });

    test("allows only one concurrent submission from independent Prisma clients", async () => {
        const data = await fixture({ verificationResult: "PASSED" });
        await addSelfie(data.visit.id, data.outside.id);
        const responses = await Promise.all([
            request(baseUrl, `/api/visits/${data.visit.id}/submit`, data.outside, { method: "POST" }),
            request(secondBaseUrl, `/api/visits/${data.visit.id}/submit`, data.outside, { method: "POST" }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: data.visit.id } }), 1);
    });

    test("allows only one concurrent Admin or Executive review decision", async () => {
        const data = await fixture({ status: "PENDING_REVIEW", verificationResult: "PASSED" });
        const responses = await Promise.all([
            request(baseUrl, `/api/admin/visits/${data.visit.id}/approve`, data.admin, { method: "PATCH" }),
            request(secondBaseUrl, `/api/admin/visits/${data.visit.id}/reject`, data.executive, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rejectionReason: "Concurrent review." }),
            }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: data.visit.id } }), 1);
    });

    test("recovers from concurrent duplicate selfie uploads using real serializable transactions", async () => {
        const data = await fixture({ verificationResult: "PASSED" });
        const responses = await Promise.all([
            request(baseUrl, `/api/visits/${data.visit.id}/evidence/selfie`, data.outside, { method: "POST", body: imageForm() }),
            request(secondBaseUrl, `/api/visits/${data.visit.id}/evidence/selfie`, data.outside, { method: "POST", body: imageForm() }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
        assert.equal(await prisma.mediaAsset.count({ where: { visitId: data.visit.id, mediaType: "VISIT_SELFIE" } }), 1);
        const selfie = await prisma.mediaAsset.findFirst({ where: { visitId: data.visit.id, mediaType: "VISIT_SELFIE" } });
        assert.match(selfie.publicId, /^selfie-/);
        assert.equal(selfie.assetId, `asset-${selfie.publicId}`);
        assert.equal(selfie.resourceType, "image");
        assert.equal(selfie.deliveryType, "authenticated");
    });

    test("does not persist audio evidence when submission wins during Cloudinary upload", async () => {
        const data = await fixture({ verificationResult: "PASSED" });
        await addSelfie(data.visit.id, data.outside.id);
        const destroyedCount = destroyedCloudinaryAssets.length;

        let startedUpload;
        let releaseUpload;
        const uploadStarted = new Promise((resolve) => { startedUpload = resolve; });
        const uploadWait = new Promise((resolve) => { releaseUpload = resolve; });
        cloudinaryUploadGate = { started: startedUpload, wait: uploadWait };

        try {
            const audioUpload = request(baseUrl, `/api/visits/${data.visit.id}/evidence/audio`, data.outside, {
                method: "POST",
                body: audioForm(),
            });
            await uploadStarted;
            const submission = await request(baseUrl, `/api/visits/${data.visit.id}/submit`, data.outside, { method: "POST" });
            assert.equal(submission.status, 200);

            releaseUpload();
            const uploadResponse = await audioUpload;
            assert.equal(uploadResponse.status, 409);
            assert.equal(await prisma.mediaAsset.count({
                where: { visitId: data.visit.id, mediaType: "AUDIO_RECORDING" },
            }), 0);
            assert.equal(destroyedCloudinaryAssets.slice(destroyedCount).some((publicId) => publicId.startsWith("audio-")), true);
        } finally {
            releaseUpload();
            cloudinaryUploadGate = null;
        }
    });

    test("persists the complete visit workflow through Admin review", async () => {
        const data = await fixture({ withVisit: false });
        const visit = await prisma.visit.create({ data: { scheduleId: data.schedule.id } });
        tracked.visits.push(visit.id);
        const verification = await request(baseUrl, `/api/visits/${visit.id}/verify-location`, data.outside, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: 12.9716, longitude: 77.5946, accuracy: 10 }),
        });
        assert.equal(verification.status, 200);
        assert.equal((await request(baseUrl, `/api/visits/${visit.id}/evidence/selfie`, data.outside, { method: "POST", body: imageForm() })).status, 201);
        assert.equal((await request(baseUrl, `/api/visits/${visit.id}/submit`, data.outside, { method: "POST" })).status, 200);
        assert.equal((await request(baseUrl, `/api/admin/visits/${visit.id}/approve`, data.admin, { method: "PATCH" })).status, 200);
        const completed = await prisma.visit.findUnique({ where: { id: visit.id } });
        const completedSchedule = await prisma.visitSchedule.findUnique({ where: { id: data.schedule.id } });
        assert.equal(completed.status, "COMPLETED");
        assert.equal(completedSchedule.status, "COMPLETED");
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: visit.id } }), 2);
    });

    test("rejecting a visit leaves its schedule uncompleted", async () => {
        const data = await fixture({ status: "PENDING_REVIEW", verificationResult: "PASSED" });
        const response = await request(baseUrl, `/api/admin/visits/${data.visit.id}/reject`, data.executive, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rejectionReason: "Evidence does not meet requirements." }),
        });
        assert.equal(response.status, 200);
        const rejectedSchedule = await prisma.visitSchedule.findUnique({ where: { id: data.schedule.id } });
        assert.equal(rejectedSchedule.status, "SCHEDULED");
    });

    test("uses the current persisted role and active status for every authenticated request", async () => {
        const data = await fixture({ status: "PENDING_REVIEW", verificationResult: "PASSED" });
        await prisma.user.update({ where: { id: data.admin.id }, data: { roleId: roles.OUTSIDE_SALES.id } });
        assert.equal((await request(baseUrl, "/api/admin/visits/pending-review", data.admin)).status, 403);
        await prisma.user.update({ where: { id: data.admin.id }, data: { isActive: false } });
        assert.equal((await request(baseUrl, "/api/admin/visits/pending-review", data.admin)).status, 401);
    });
}
