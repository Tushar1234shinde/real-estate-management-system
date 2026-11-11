import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createIntegrationPrisma, requireTestDatabaseUrl } from "./support/testDatabase.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);

if (!enabled) {
    test("PostgreSQL integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
    const testDatabaseUrl = requireTestDatabaseUrl();
    // The integration runner sets DATABASE_URL from this already-validated value.
    process.env.DATABASE_URL = testDatabaseUrl;

    const [{ createApp }, { createVisitSubmissionController }, { createAdminVisitReviewController }] = await Promise.all([
        import("../src/app.js"),
        import("../src/controllers/visitSubmissionController.js"),
        import("../src/controllers/adminVisitReviewController.js"),
    ]);
    const prisma = createIntegrationPrisma(testDatabaseUrl);
    const secondPrisma = createIntegrationPrisma(testDatabaseUrl);
    const jwtConfig = { secret: crypto.randomBytes(32).toString("base64url"), expiresIn: "1h" };
    const runId = `integration-${crypto.randomUUID()}`;
    const tracked = { users: [], customers: [], properties: [], schedules: [], visits: [] };
    const roles = {};
    let server;
    let secondServer;
    let baseUrl;
    let secondBaseUrl;

    const cloudinaryClient = {
        uploader: {
            upload_stream(options, callback) {
                return {
                    end(buffer) {
                        callback(null, {
                            public_id: options.public_id,
                            secure_url: `https://example.invalid/${options.public_id}`,
                            bytes: buffer.length,
                            duration: 1,
                        });
                    },
                };
            },
            async destroy() {
                return { result: "ok" };
            },
        },
    };

    function tokenFor(user) {
        return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, { algorithm: "HS256", expiresIn: "1h" });
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

    async function cleanupTrackedRecords() {
        if (tracked.visits.length) {
            await prisma.visitStatusHistory.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.mediaAsset.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.visit.deleteMany({ where: { id: { in: tracked.visits } } });
        }
        if (tracked.schedules.length) await prisma.visitSchedule.deleteMany({ where: { id: { in: tracked.schedules } } });
        if (tracked.customers.length) await prisma.customer.deleteMany({ where: { id: { in: tracked.customers } } });
        if (tracked.properties.length) await prisma.property.deleteMany({ where: { id: { in: tracked.properties } } });
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
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: data.visit.id } }), 0);
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
        assert.equal(completed.status, "COMPLETED");
        assert.equal(await prisma.visitStatusHistory.count({ where: { visitId: visit.id } }), 2);
    });

    test("uses the current persisted role and active status for every authenticated request", async () => {
        const data = await fixture({ status: "PENDING_REVIEW", verificationResult: "PASSED" });
        await prisma.user.update({ where: { id: data.admin.id }, data: { roleId: roles.OUTSIDE_SALES.id } });
        assert.equal((await request(baseUrl, "/api/admin/visits/pending-review", data.admin)).status, 403);
        await prisma.user.update({ where: { id: data.admin.id }, data: { isActive: false } });
        assert.equal((await request(baseUrl, "/api/admin/visits/pending-review", data.admin)).status, 401);
    });
}
