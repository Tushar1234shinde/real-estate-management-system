import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { createCloudinaryClient } from "../src/config/cloudinary.js";
import { createIntegrationPrisma } from "./support/testDatabase.js";
import { requireCloudinaryTestConfig } from "./support/cloudinaryTest.js";

const enabled = process.env.CLOUDINARY_TEST_ENABLED === "true";

if (!enabled) {
    test("real Cloudinary integration tests require explicit opt-in", { skip: true }, () => {});
} else {
    const configuration = requireCloudinaryTestConfig();
    const jwtConfig = {
        secret: crypto.randomBytes(32).toString("base64url"),
        expiresIn: "1h",
        issuer: "integration-real-estate-api",
        audience: "integration-real-estate-client",
    };
    const cloudinaryEnvironment = {
        CLOUDINARY_CLOUD_NAME: configuration.cloudName,
        CLOUDINARY_API_KEY: configuration.apiKey,
        CLOUDINARY_API_SECRET: configuration.apiSecret,
        CLOUDINARY_EVIDENCE_FOLDER: configuration.evidenceFolder,
        CLOUDINARY_EVIDENCE_ACCESS_TTL_SECONDS: "60",
    };
    const prisma = createIntegrationPrisma(configuration.testDatabaseUrl);
    const tracked = { users: [], customers: [], properties: [], schedules: [], visits: [] };
    const createdAssets = new Map();
    const destroyedAssets = new Set();
    const roles = {};
    let cloudinary;
    let appServer;
    let failingAppServer;
    let baseUrl;
    let failingBaseUrl;
    let fixture;

    function ownedPublicId(publicId) {
        return typeof publicId === "string" && publicId.startsWith(`${configuration.evidenceFolder}/`);
    }

    function trackAsset(result) {
        if (result?.public_id && ownedPublicId(result.public_id)) {
            createdAssets.set(result.public_id, result.resource_type);
        }
    }

    function createTrackingCloudinaryClient() {
        return {
            uploader: {
                upload_stream(options, callback) {
                    return cloudinary.uploader.upload_stream(options, (error, result) => {
                        if (result) trackAsset(result);
                        callback(error, result);
                    });
                },
                async destroy(publicId, options) {
                    const result = await cloudinary.uploader.destroy(publicId, options);
                    if (ownedPublicId(publicId)) destroyedAssets.add(publicId);
                    return result;
                },
            },
            utils: cloudinary.utils,
        };
    }

    function tokenFor(user) {
        return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        });
    }

    async function start(app) {
        const server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });
        return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
    }

    function request(url, path, user, options = {}) {
        return fetch(`${url}${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
        });
    }

    function imageForm() {
        const bytes = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=", "base64");
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: "image/jpeg" }), "selfie.jpg");
        return form;
    }

    function audioForm() {
        const sampleRate = 8000;
        const samples = Buffer.alloc(sampleRate, 128);
        const bytes = Buffer.alloc(44 + samples.length);
        bytes.write("RIFF", 0);
        bytes.writeUInt32LE(36 + samples.length, 4);
        bytes.write("WAVEfmt ", 8);
        bytes.writeUInt32LE(16, 16);
        bytes.writeUInt16LE(1, 20);
        bytes.writeUInt16LE(1, 22);
        bytes.writeUInt32LE(sampleRate, 24);
        bytes.writeUInt32LE(sampleRate, 28);
        bytes.writeUInt16LE(1, 32);
        bytes.writeUInt16LE(8, 34);
        bytes.write("data", 36);
        bytes.writeUInt32LE(samples.length, 40);
        samples.copy(bytes, 44);
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: "audio/wav" }), "note.wav");
        return form;
    }

    async function createFixture() {
        const nonce = `${configuration.runId}-${crypto.randomUUID()}`;
        const createUser = async (roleName, label) => {
            const user = await prisma.user.create({
                data: {
                    roleId: roles[roleName].id,
                    fullName: `${label} ${nonce}`,
                    email: `${label}-${nonce}@cloudinary.integration.test`,
                    passwordHash: "cloudinary-integration-test-hash",
                },
            });
            tracked.users.push(user.id);
            return user;
        };
        const admin = await createUser("ADMIN", "admin");
        const executive = await createUser("EXECUTIVE", "executive");
        const inside = await createUser("INSIDE_SALES", "inside");
        const outside = await createUser("OUTSIDE_SALES", "outside");
        const otherOutside = await createUser("OUTSIDE_SALES", "other-outside");
        const customer = await prisma.customer.create({ data: { fullName: "Cloudinary Test Customer", phone: `9${crypto.randomInt(10 ** 9, 10 ** 10 - 1)}` } });
        tracked.customers.push(customer.id);
        const property = await prisma.property.create({
            data: { title: "Cloudinary Test Property", location: "Test Location", latitude: 12.9716, longitude: 77.5946, verificationRadiusMeters: 200, price: "100000.00" },
        });
        tracked.properties.push(property.id);
        const schedule = await prisma.visitSchedule.create({
            data: { customerId: customer.id, propertyId: property.id, insideSalesEmployeeId: inside.id, outsideSalesEmployeeId: outside.id, scheduledByUserId: admin.id, scheduledAt: new Date() },
        });
        tracked.schedules.push(schedule.id);
        const visit = await prisma.visit.create({
            data: { scheduleId: schedule.id, status: "IN_PROGRESS", verificationResult: "PASSED", verificationCheckedAt: new Date(), reachedLatitude: 12.9716, reachedLongitude: 77.5946, verificationDistanceMeters: 0 },
        });
        tracked.visits.push(visit.id);
        return { admin, executive, outside, otherOutside, visit };
    }

    function failingPrismaClient() {
        return new Proxy(prisma, {
            get(target, property, receiver) {
                if (property !== "mediaAsset") return Reflect.get(target, property, receiver);
                return new Proxy(target.mediaAsset, {
                    get(delegate, delegateProperty, delegateReceiver) {
                        if (delegateProperty === "create") return async () => { throw new Error("Forced test-only database persistence failure."); };
                        return Reflect.get(delegate, delegateProperty, delegateReceiver);
                    },
                });
            },
        });
    }

    async function cleanDatabase() {
        if (tracked.visits.length) {
            await prisma.visitStatusHistory.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.mediaAsset.deleteMany({ where: { visitId: { in: tracked.visits } } });
            await prisma.visit.deleteMany({ where: { id: { in: tracked.visits } } });
        }
        if (tracked.schedules.length) await prisma.visitSchedule.deleteMany({ where: { id: { in: tracked.schedules } } });
        if (tracked.customers.length) await prisma.customer.deleteMany({ where: { id: { in: tracked.customers } } });
        if (tracked.properties.length) await prisma.property.deleteMany({ where: { id: { in: tracked.properties } } });
        if (tracked.users.length) await prisma.user.deleteMany({ where: { id: { in: tracked.users } } });
    }

    before(async () => {
        cloudinary = createCloudinaryClient(cloudinaryEnvironment);
        for (const name of ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]) {
            roles[name] = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
        }
        fixture = await createFixture();
        ({ server: appServer, baseUrl } = await start(createApp({ prismaClient: prisma, jwtConfig, corsOptions: { origin: false }, cloudinaryClient: createTrackingCloudinaryClient(), environment: cloudinaryEnvironment })));
        ({ server: failingAppServer, baseUrl: failingBaseUrl } = await start(createApp({ prismaClient: failingPrismaClient(), jwtConfig, corsOptions: { origin: false }, cloudinaryClient: createTrackingCloudinaryClient(), environment: cloudinaryEnvironment })));
    });

    after(async () => {
        for (const [publicId, resourceType] of createdAssets) {
            if (!destroyedAssets.has(publicId) && ownedPublicId(publicId)) {
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: "authenticated", invalidate: true });
            }
        }
        await cleanDatabase();
        await Promise.all([
            new Promise((resolve, reject) => appServer.close((error) => (error ? reject(error) : resolve()))),
            new Promise((resolve, reject) => failingAppServer.close((error) => (error ? reject(error) : resolve()))),
        ]);
        await prisma.$disconnect();
    });

    test("uploads real authenticated selfie and audio evidence and persists Cloudinary metadata", async () => {
        const selfieResponse = await request(baseUrl, `/api/visits/${fixture.visit.id}/evidence/selfie`, fixture.outside, { method: "POST", body: imageForm() });
        const audioResponse = await request(baseUrl, `/api/visits/${fixture.visit.id}/evidence/audio`, fixture.outside, { method: "POST", body: audioForm() });
        const selfieBody = await selfieResponse.json();
        const audioBody = await audioResponse.json();

        assert.equal(selfieResponse.status, 201);
        assert.equal(audioResponse.status, 201);
        assert.equal(selfieBody.data.media.resourceType, "image");
        assert.equal(audioBody.data.media.resourceType, "video");
        assert.equal(selfieBody.data.media.deliveryType, "authenticated");
        assert.equal(audioBody.data.media.deliveryType, "authenticated");
        assert.equal(ownedPublicId(selfieBody.data.media.publicId), true);
        assert.equal(ownedPublicId(audioBody.data.media.publicId), true);

        const records = await prisma.mediaAsset.findMany({ where: { visitId: fixture.visit.id }, orderBy: { id: "asc" } });
        assert.equal(records.length, 2);
        assert.deepEqual(records.map((record) => record.resourceType).sort(), ["image", "video"]);
        assert.equal(records.every((record) => record.deliveryType === "authenticated" && record.assetId && ownedPublicId(record.publicId)), true);
    });

    test("rejects unsigned evidence delivery and permits only authorized short-lived signed access", async () => {
        const selfie = await prisma.mediaAsset.findFirst({ where: { visitId: fixture.visit.id, mediaType: "VISIT_SELFIE" } });
        // Cloudinary's upload response can provide a delivery URL that is already
        // signed. Build an explicitly unsigned authenticated URL to verify that
        // anonymous delivery is rejected.
        const unsignedUrl = cloudinary.url(selfie.publicId, {
            resource_type: selfie.resourceType,
            type: selfie.deliveryType,
            format: "jpg",
            secure: true,
            sign_url: false,
        });
        assert.equal(unsignedUrl.includes("/s--"), false);
        const unsignedResponse = await fetch(unsignedUrl, { redirect: "manual" });
        const signedResponse = await request(baseUrl, `/api/admin/visits/${fixture.visit.id}/evidence/${selfie.id}/access`, fixture.admin);
        const signedBody = await signedResponse.json();
        const signedDelivery = await fetch(signedBody.data.accessUrl);
        const expiredUrl = cloudinary.utils.private_download_url(selfie.publicId, "jpg", {
            resource_type: selfie.resourceType,
            type: selfie.deliveryType,
            expires_at: Math.floor(Date.now() / 1000) - 60,
        });
        const expiredDelivery = await fetch(expiredUrl, { redirect: "manual" });
        const executive = await request(baseUrl, `/api/admin/visits/${fixture.visit.id}/evidence/${selfie.id}/access`, fixture.executive);
        const outside = await request(baseUrl, `/api/admin/visits/${fixture.visit.id}/evidence/${selfie.id}/access`, fixture.outside);
        const otherOutside = await request(baseUrl, `/api/admin/visits/${fixture.visit.id}/evidence/${selfie.id}/access`, fixture.otherOutside);

        assert.equal(unsignedResponse.ok, false);
        assert.equal(signedResponse.status, 200);
        assert.equal(signedDelivery.ok, true);
        assert.equal(expiredDelivery.ok, false);
        assert.ok(signedBody.data.expiresAt >= Math.floor(Date.now() / 1000) + 55);
        assert.equal(executive.status, 200);
        assert.equal(outside.status, 403);
        assert.equal(otherOutside.status, 403);
    });

    test("destroys a real test-owned Cloudinary asset when database persistence fails", async () => {
        const before = new Set(createdAssets.keys());
        const response = await request(failingBaseUrl, `/api/visits/${fixture.visit.id}/evidence/audio`, fixture.outside, { method: "POST", body: audioForm() });
        const createdDuringFailure = [...createdAssets.keys()].find((publicId) => !before.has(publicId));

        assert.equal(response.status, 500);
        assert.equal(ownedPublicId(createdDuringFailure), true);
        assert.equal(destroyedAssets.has(createdDuringFailure), true);
        await assert.rejects(
            cloudinary.api.resource(createdDuringFailure, { resource_type: "video", type: "authenticated" }),
        );
    });
}
