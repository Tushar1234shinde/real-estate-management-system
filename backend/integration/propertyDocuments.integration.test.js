import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createIntegrationPrisma, requireTestDatabaseUrl } from "./support/testDatabase.js";

const enabled = process.env.TEST_DATABASE_URL !== undefined || process.env.INTEGRATION_TESTS_ENABLED === "true";

if (!enabled) {
    test("property documents PostgreSQL integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
    const testDatabaseUrl = requireTestDatabaseUrl();
    const prisma = createIntegrationPrisma(testDatabaseUrl);
    process.env.DATABASE_URL = testDatabaseUrl;
    const jwtConfig = {
        secret: crypto.randomBytes(32).toString("base64url"),
        expiresIn: "1h",
        issuer: "integration-property-documents-api",
        audience: "integration-property-documents-client",
    };
    const runId = `property-documents-${crypto.randomUUID()}`;
    const tracked = { users: [], properties: [], customers: [], schedules: [], documents: [] };
    const uploadedAssets = new Map();
    const destroyedAssets = [];
    const signingOptions = [];
    let server;
    let baseUrl;
    let uploadCount = 0;

    const cloudinaryClient = {
        uploader: {
            upload_stream(options, callback) {
                return {
                    end(buffer) {
                        uploadCount += 1;
                        const result = {
                            public_id: options.public_id,
                            asset_id: `asset-${options.public_id}`,
                            resource_type: options.resource_type,
                            type: options.type,
                            secure_url: `https://res.cloudinary.com/test-cloud/${options.resource_type}/authenticated/${options.public_id}`,
                            bytes: buffer.length,
                        };
                        uploadedAssets.set(result.public_id, result);
                        callback(null, result);
                    },
                };
            },
            async destroy(publicId) {
                destroyedAssets.push(publicId);
                uploadedAssets.delete(publicId);
                return { result: "ok" };
            },
        },
        utils: {
            private_download_url(publicId, format, options) {
                signingOptions.push({ publicId, format, options });
                return `https://api.cloudinary.com/private/${publicId}.${format}?signature=mock`;
            },
        },
    };

    const appPromise = Promise.all([
        import("../src/app.js"),
    ]).then(([{ createApp }]) => createApp({
        prismaClient: prisma,
        jwtConfig,
        cloudinaryClient,
        environment: { CLOUDINARY_PROPERTY_DOCUMENTS_FOLDER: "integration-property-documents" },
    }));

    async function start() {
        const app = await appPromise;
        server = await new Promise((resolve) => {
            const listeningServer = app.listen(0, () => resolve(listeningServer));
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    }

    function tokenFor(user) {
        return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        });
    }

    async function request(path, user, options = {}) {
        return fetch(`${baseUrl}${path}`, {
            ...options,
            headers: { Authorization: `Bearer ${tokenFor(user)}`, ...(options.headers ?? {}) },
        });
    }

    async function cleanupTrackedRecords() {
        if (tracked.documents.length) {
            await prisma.propertyDocument.deleteMany({ where: { id: { in: tracked.documents } } });
        }
        if (tracked.schedules.length) {
            await prisma.visitSchedule.deleteMany({ where: { id: { in: tracked.schedules } } });
        }
        if (tracked.customers.length) {
            await prisma.customer.deleteMany({ where: { id: { in: tracked.customers } } });
        }
        if (tracked.properties.length) {
            await prisma.property.deleteMany({ where: { id: { in: tracked.properties } } });
        }
        if (tracked.users.length) {
            await prisma.user.deleteMany({ where: { id: { in: tracked.users } } });
        }
        Object.values(tracked).forEach((items) => items.splice(0));
        uploadedAssets.clear();
        destroyedAssets.splice(0);
        signingOptions.splice(0);
        uploadCount = 0;
    }

    async function fixture() {
        const roles = {};
        for (const roleName of ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]) {
            roles[roleName] = await prisma.role.findUnique({ where: { name: roleName } });
            assert.ok(roles[roleName], `Missing seeded role ${roleName}.`);
        }

        const users = {};
        for (const roleName of Object.keys(roles)) {
            const user = await prisma.user.create({
                data: {
                    roleId: roles[roleName].id,
                    fullName: `${runId} ${roleName}`,
                    email: `${runId}-${roleName.toLowerCase()}@integration.test`,
                    passwordHash: "integration-test-hash",
                },
            });
            users[roleName] = user;
            tracked.users.push(user.id);
        }

        const availableProperty = await prisma.property.create({
            data: { title: `${runId} available`, location: "Integration location", price: "100000.00", status: "AVAILABLE" },
        });
        const soldProperty = await prisma.property.create({
            data: { title: `${runId} sold`, location: "Integration location", price: "200000.00", status: "SOLD" },
        });
        tracked.properties.push(availableProperty.id, soldProperty.id);

        const customer = await prisma.customer.create({
            data: { fullName: `${runId} customer`, phone: `+1415${crypto.randomInt(1_000_000, 10_000_000)}` },
        });
        tracked.customers.push(customer.id);
        const schedule = await prisma.visitSchedule.create({
            data: {
                customerId: customer.id,
                propertyId: availableProperty.id,
                insideSalesEmployeeId: users.INSIDE_SALES.id,
                outsideSalesEmployeeId: users.OUTSIDE_SALES.id,
                scheduledByUserId: users.INSIDE_SALES.id,
                scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
                status: "SCHEDULED",
            },
        });
        tracked.schedules.push(schedule.id);
        return { users, availableProperty, soldProperty };
    }

    before(async () => {
        await start();
    });

    afterEach(async () => {
        await cleanupTrackedRecords();
    });

    after(async () => {
        if (server) {
            await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        }
        await prisma.$disconnect();
    });

    test("stores private Cloudinary metadata, enforces scoped reads, signs access, and deletes safely", async () => {
        const { users, availableProperty, soldProperty } = await fixture();
        const form = new FormData();
        form.append("files", new Blob([Buffer.from("%PDF-1.7\nproperty document")], { type: "application/pdf" }), "agreement.pdf");
        form.append("files", new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "photo.jpg");

        const uploadResponse = await request(
            `/api/admin/properties/${availableProperty.id}/documents`,
            users.ADMIN,
            { method: "POST", body: form },
        );
        const uploadBody = await uploadResponse.json();
        assert.equal(uploadResponse.status, 201);
        assert.equal(uploadBody.data.documents.length, 2);
        const documentId = uploadBody.data.documents[0].id;
        tracked.documents.push(...uploadBody.data.documents.map((document) => document.id));

        const stored = await prisma.propertyDocument.findUnique({ where: { id: documentId } });
        assert.ok(stored.publicId);
        assert.ok(stored.assetId);
        assert.equal(stored.deliveryType, "authenticated");
        assert.equal(stored.resourceType, "raw");
        assert.equal(stored.fileSizeBytes, BigInt(Buffer.byteLength("%PDF-1.7\nproperty document")));
        assert.equal("documentUrl" in uploadBody.data.documents[0], false);

        const adminList = await request(`/api/admin/properties/${availableProperty.id}/documents`, users.ADMIN);
        assert.equal(adminList.status, 200);
        const insideList = await request(`/api/inside-sales/properties/${availableProperty.id}/documents`, users.INSIDE_SALES);
        const insideDenied = await request(`/api/inside-sales/properties/${soldProperty.id}/documents`, users.INSIDE_SALES);
        const outsideList = await request(`/api/outside-sales/properties/${availableProperty.id}/documents`, users.OUTSIDE_SALES);
        const outsideDenied = await request(`/api/outside-sales/properties/${soldProperty.id}/documents`, users.OUTSIDE_SALES);
        assert.equal(insideList.status, 200);
        assert.equal(insideDenied.status, 404);
        assert.equal(outsideList.status, 200);
        assert.equal(outsideDenied.status, 404);

        const accessResponse = await request(
            `/api/outside-sales/properties/${availableProperty.id}/documents/${documentId}/access`,
            users.OUTSIDE_SALES,
        );
        const accessBody = await accessResponse.json();
        assert.equal(accessResponse.status, 200);
        assert.match(accessBody.data.url, /^https:\/\/api\.cloudinary\.com\//);
        assert.equal(signingOptions[0].options.type, "authenticated");
        assert.equal(signingOptions[0].options.attachment, true);
        assert.ok(signingOptions[0].options.expires_at <= Math.floor(Date.now() / 1000) + 301);

        const deleteResponse = await request(
            `/api/admin/properties/${availableProperty.id}/documents/${documentId}`,
            users.EXECUTIVE,
            { method: "DELETE" },
        );
        assert.equal(deleteResponse.status, 200);
        assert.equal(await prisma.propertyDocument.findUnique({ where: { id: documentId } }), null);
        assert.equal(destroyedAssets.includes(stored.publicId), true);
        tracked.documents.splice(tracked.documents.indexOf(documentId), 1);
    });
}
