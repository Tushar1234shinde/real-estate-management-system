import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "property-documents-test",
    audience: "property-documents-client",
};
const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", role: { name: "ADMIN" }, isActive: true },
    { id: 2, fullName: "Executive User", email: "executive@example.com", role: { name: "EXECUTIVE" }, isActive: true },
    { id: 3, fullName: "Inside User", email: "inside@example.com", role: { name: "INSIDE_SALES" }, isActive: true },
    { id: 4, fullName: "Outside User", email: "outside@example.com", role: { name: "OUTSIDE_SALES" }, isActive: true },
];
const properties = [
    { id: 21, status: "AVAILABLE" },
    { id: 22, status: "SOLD" },
    { id: 23, status: "AVAILABLE" },
];
const assignedSchedules = [{ propertyId: 21, outsideSalesEmployeeId: 4 }];
const documents = [];
const cloudAssets = new Map();
const uploadedOptions = [];
const destroyedAssets = [];
const signedUrlOptions = [];
let nextDocumentId = 1;
let uploadAttempts = 0;
let uploadFailureAt = null;
let destroyFailure = false;
let signingFailure = false;
let createFailure = false;
let deleteFailure = false;
let server;
let baseUrl;

function resetState() {
    documents.splice(0);
    cloudAssets.clear();
    uploadedOptions.splice(0);
    destroyedAssets.splice(0);
    signedUrlOptions.splice(0);
    nextDocumentId = 1;
    uploadAttempts = 0;
    uploadFailureAt = null;
    destroyFailure = false;
    signingFailure = false;
    createFailure = false;
    deleteFailure = false;
}

function matchesProperty(property, where) {
    if (where.id !== undefined && property.id !== where.id) return false;
    if (where.status !== undefined && property.status !== where.status) return false;
    const assignedTo = where.visitSchedules?.some?.outsideSalesEmployeeId;
    if (assignedTo !== undefined
        && !assignedSchedules.some((schedule) => schedule.propertyId === property.id
            && schedule.outsideSalesEmployeeId === assignedTo)) return false;
    return true;
}

const prismaClient = {
    user: {
        async findUnique({ where }) {
            return users.find((user) => user.id === where.id) ?? null;
        },
    },
    property: {
        async findUnique({ where }) {
            return properties.find((property) => matchesProperty(property, where)) ?? null;
        },
        async findFirst({ where }) {
            return properties.find((property) => matchesProperty(property, where)) ?? null;
        },
    },
    propertyDocument: {
        async create({ data }) {
            if (createFailure) throw new Error("Injected persistence failure.");
            const user = users.find(({ id }) => id === data.uploadedByUserId);
            const document = {
                id: nextDocumentId,
                ...data,
                uploadedAt: new Date(),
                uploadedBy: { id: user.id, fullName: user.fullName },
                messageAttachmentCount: 0,
            };
            nextDocumentId += 1;
            documents.push(document);
            return document;
        },
        async findMany({ where, skip, take }) {
            return documents
                .filter((document) => document.propertyId === where.propertyId)
                .sort((left, right) => right.uploadedAt - left.uploadedAt || right.id - left.id)
                .slice(skip, skip + take);
        },
        async count({ where }) {
            return documents.filter((document) => document.propertyId === where.propertyId).length;
        },
        async findFirst({ where, select }) {
            const document = documents.find((candidate) => (
                candidate.id === where.id && candidate.propertyId === where.propertyId
            ));
            if (!document) return null;
            return select?._count
                ? { ...document, _count: { messageAttachments: document.messageAttachmentCount } }
                : document;
        },
        async delete({ where }) {
            if (deleteFailure) throw new Error("Injected database deletion failure.");
            const index = documents.findIndex((document) => document.id === where.id);
            if (index < 0) throw Object.assign(new Error("Missing record."), { code: "P2025" });
            return documents.splice(index, 1)[0];
        },
    },
    async $transaction(operation) {
        return Array.isArray(operation) ? Promise.all(operation) : operation(prismaClient);
    },
};

const cloudinaryClient = {
    uploader: {
        upload_stream(options, callback) {
            return {
                end(buffer) {
                    uploadAttempts += 1;
                    uploadedOptions.push(options);
                    if (uploadAttempts === uploadFailureAt) {
                        callback(new Error("Provider detail must not be exposed."));
                        return;
                    }
                    const uploaded = {
                        public_id: options.public_id,
                        asset_id: `asset-${options.public_id}`,
                        resource_type: options.resource_type,
                        type: options.type,
                        secure_url: `https://res.cloudinary.com/test-cloud/${options.resource_type}/authenticated/${options.public_id}`,
                        bytes: buffer.length,
                    };
                    cloudAssets.set(uploaded.public_id, uploaded);
                    callback(null, uploaded);
                },
            };
        },
        async destroy(publicId, options) {
            destroyedAssets.push({ publicId, options });
            if (destroyFailure) throw new Error("Provider detail must not be exposed.");
            cloudAssets.delete(publicId);
            return { result: "ok" };
        },
    },
    utils: {
        private_download_url(publicId, format, options) {
            if (signingFailure) throw new Error("Do not expose provider signature details.");
            signedUrlOptions.push({ publicId, format, options });
            return `https://api.cloudinary.com/private/${publicId}.${format}?expires_at=${options.expires_at}&signature=test`;
        },
    },
};

const app = createApp({
    prismaClient,
    jwtConfig,
    cloudinaryClient,
    environment: { CLOUDINARY_PROPERTY_DOCUMENTS_FOLDER: "unit-property-documents" },
});

before(async () => {
    server = await new Promise((resolve) => {
        const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(resetState);

function tokenFor(user) {
    return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
}

function authHeaders(user) {
    return { Authorization: `Bearer ${tokenFor(user)}` };
}

function testFile(name, type, content) {
    return { name, type, content: Buffer.from(content) };
}

const validPdf = testFile("purchase-agreement.pdf", "application/pdf", "%PDF-1.7\nsample");
const validJpeg = testFile("property-photo.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xd9]);
const validPng = testFile("floor-plan.png", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function uploadDocuments(user, propertyId, files) {
    const form = new FormData();
    for (const file of files) {
        form.append("files", new Blob([file.content], { type: file.type }), file.name);
    }
    return fetch(`${baseUrl}/api/admin/properties/${propertyId}/documents`, {
        method: "POST",
        headers: authHeaders(user),
        body: form,
    });
}

async function seedDocument({
    propertyId = 21,
    publicId = "unit/seeded-document",
    resourceType = "raw",
    deliveryType = "authenticated",
    name = "seeded.pdf",
    messageAttachmentCount = 0,
} = {}) {
    const document = {
        id: nextDocumentId++,
        propertyId,
        uploadedByUserId: 1,
        documentName: name,
        documentUrl: "https://res.cloudinary.com/never-return-this",
        publicId,
        assetId: `asset-${publicId}`,
        resourceType,
        deliveryType,
        fileSizeBytes: 120n,
        mimeType: "application/pdf",
        uploadedAt: new Date(),
        uploadedBy: { id: 1, fullName: "Admin User" },
        messageAttachmentCount,
    };
    documents.push(document);
    cloudAssets.set(publicId, { public_id: publicId });
    return document;
}

test("ADMIN uploads multiple private documents and stores only metadata in PostgreSQL", async () => {
    const response = await uploadDocuments(users[0], 21, [validPdf, validJpeg]);
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.documents.length, 2);
    assert.equal(documents.length, 2);
    assert.equal(body.data.documents[0].originalFileName, validPdf.name);
    assert.equal(body.data.documents[0].fileSizeBytes, String(validPdf.content.length));
    assert.equal(body.data.documents[0].uploadedBy.id, users[0].id);
    assert.equal("documentUrl" in body.data.documents[0], false);
    assert.equal("publicId" in body.data.documents[0], false);
    assert.equal(JSON.stringify(body).includes("never-return-this"), false);
    assert.equal(uploadedOptions.every((options) => options.type === "authenticated" && options.overwrite === false), true);
    assert.equal(uploadedOptions[0].resource_type, "raw");
    assert.equal(uploadedOptions[1].resource_type, "image");
});

test("EXECUTIVE can upload property documents", async () => {
    const response = await uploadDocuments(users[1], 21, [validPng]);
    assert.equal(response.status, 201);
    assert.equal(documents[0].uploadedByUserId, users[1].id);
});

test("INSIDE_SALES and OUTSIDE_SALES cannot upload property documents", async () => {
    for (const user of [users[2], users[3]]) {
        const response = await uploadDocuments(user, 21, [validPdf]);
        assert.equal(response.status, 403);
    }
    assert.equal(uploadedOptions.length, 0);
});

test("rejects mismatched extensions, MIME types, and file signatures before Cloudinary upload", async () => {
    const invalid = [
        testFile("document.exe", "application/pdf", "%PDF-1.7"),
        testFile("document.pdf", "application/pdf", "not a PDF"),
        testFile("document.jpg", "image/png", [0xff, 0xd8, 0xff]),
    ];
    for (const file of invalid) {
        const response = await uploadDocuments(users[0], 21, [file]);
        assert.equal(response.status, 400);
    }
    assert.equal(uploadedOptions.length, 0);
});

test("rejects property document files over the 10 MiB limit", async () => {
    const oversized = testFile("large.pdf", "application/pdf", Buffer.concat([
        Buffer.from("%PDF-1.7\n"),
        Buffer.alloc(10 * 1024 * 1024),
    ]));
    const response = await uploadDocuments(users[0], 21, [oversized]);
    assert.equal(response.status, 413);
    assert.equal(uploadedOptions.length, 0);
});

test("rejects more than five property documents in one request", async () => {
    const response = await uploadDocuments(users[0], 21, Array.from({ length: 6 }, (_, index) => (
        testFile(`document-${index}.pdf`, "application/pdf", "%PDF-1.7\nsample")
    )));
    assert.equal(response.status, 400);
    assert.equal(uploadedOptions.length, 0);
});

test("does not upload files for a nonexistent property", async () => {
    const response = await uploadDocuments(users[0], 999, [validPdf]);
    assert.equal(response.status, 404);
    assert.equal(uploadedOptions.length, 0);
});

test("INSIDE_SALES can list documents only for properties offered as AVAILABLE", async () => {
    await seedDocument({ propertyId: 21 });
    await seedDocument({ propertyId: 22 });
    const allowed = await fetch(`${baseUrl}/api/inside-sales/properties/21/documents`, {
        headers: authHeaders(users[2]),
    });
    const denied = await fetch(`${baseUrl}/api/inside-sales/properties/22/documents`, {
        headers: authHeaders(users[2]),
    });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).data.documents.length, 1);
    assert.equal(denied.status, 404);
});

test("OUTSIDE_SALES can access only properties in their assigned visit-schedule workflow", async () => {
    await seedDocument({ propertyId: 21 });
    const allowed = await fetch(`${baseUrl}/api/outside-sales/properties/21/documents`, {
        headers: authHeaders(users[3]),
    });
    const denied = await fetch(`${baseUrl}/api/outside-sales/properties/23/documents`, {
        headers: authHeaders(users[3]),
    });
    assert.equal(allowed.status, 200);
    assert.equal(denied.status, 404);
});

test("generates a short-lived authenticated Cloudinary download URL after authorization", async () => {
    const document = await seedDocument();
    const response = await fetch(`${baseUrl}/api/inside-sales/properties/21/documents/${document.id}/access`, {
        headers: authHeaders(users[2]),
    });
    const body = await response.json();
    const options = signedUrlOptions[0];

    assert.equal(response.status, 200);
    assert.match(body.data.url, /^https:\/\/api\.cloudinary\.com\//);
    assert.equal(body.data.documentId, document.id);
    assert.equal(options.publicId, document.publicId);
    assert.equal(options.format, "pdf");
    assert.equal(options.options.type, "authenticated");
    assert.equal(options.options.resource_type, "raw");
    assert.equal(options.options.attachment, true);
    const now = Math.floor(Date.now() / 1000);
    assert.ok(options.options.expires_at >= now + 299);
    assert.ok(options.options.expires_at <= now + 300);
    assert.equal(JSON.stringify(body).includes("never-return-this"), false);
});

test("does not generate access URLs for mismatched, invalid, or legacy document identifiers", async () => {
    const document = await seedDocument({ propertyId: 21 });
    const wrongProperty = await fetch(`${baseUrl}/api/inside-sales/properties/23/documents/${document.id}/access`, {
        headers: authHeaders(users[2]),
    });
    const invalidId = await fetch(`${baseUrl}/api/inside-sales/properties/21/documents/not-an-id/access`, {
        headers: authHeaders(users[2]),
    });
    const legacy = await seedDocument({ publicId: null });
    const unavailable = await fetch(`${baseUrl}/api/admin/properties/21/documents/${legacy.id}/access`, {
        headers: authHeaders(users[0]),
    });

    assert.equal(wrongProperty.status, 404);
    assert.equal(invalidId.status, 400);
    assert.equal(unavailable.status, 409);
    assert.equal(signedUrlOptions.length, 0);
});

test("returns a safe error if Cloudinary cannot create an expiring access URL", async () => {
    const document = await seedDocument();
    signingFailure = true;
    const response = await fetch(`${baseUrl}/api/admin/properties/21/documents/${document.id}/access`, {
        headers: authHeaders(users[0]),
    });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(body).includes("provider signature"), false);
});

test("ADMIN cannot delete documents through an unrelated property association", async () => {
    const document = await seedDocument({ propertyId: 21 });
    const response = await fetch(`${baseUrl}/api/admin/properties/23/documents/${document.id}`, {
        method: "DELETE",
        headers: authHeaders(users[0]),
    });
    assert.equal(response.status, 404);
    assert.equal(documents.length, 1);
    assert.equal(destroyedAssets.length, 0);
});

test("INSIDE_SALES and OUTSIDE_SALES cannot delete documents", async () => {
    const document = await seedDocument();
    for (const user of [users[2], users[3]]) {
        const response = await fetch(`${baseUrl}/api/admin/properties/21/documents/${document.id}`, {
            method: "DELETE",
            headers: authHeaders(user),
        });
        assert.equal(response.status, 403);
    }
    assert.equal(documents.length, 1);
    assert.equal(destroyedAssets.length, 0);
});

test("a Cloudinary deletion failure leaves the database record intact", async () => {
    const document = await seedDocument();
    destroyFailure = true;
    const response = await fetch(`${baseUrl}/api/admin/properties/21/documents/${document.id}`, {
        method: "DELETE",
        headers: authHeaders(users[0]),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(JSON.stringify(body).includes("Provider detail"), false);
    assert.equal(documents.length, 1);
});

test("an uploaded asset is cleaned up when database persistence fails", async () => {
    createFailure = true;
    const response = await uploadDocuments(users[0], 21, [validPdf]);
    assert.equal(response.status, 500);
    assert.equal(documents.length, 0);
    assert.equal(cloudAssets.size, 0);
    assert.equal(destroyedAssets.length, 1);
});

test("cleans up earlier uploads when a later Cloudinary upload fails", async () => {
    uploadFailureAt = 2;
    const response = await uploadDocuments(users[0], 21, [validPdf, validJpeg]);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(documents.length, 0);
    assert.equal(cloudAssets.size, 0);
    assert.equal(destroyedAssets.length, 2);
    assert.equal(JSON.stringify(body).includes("Provider detail"), false);
});

test("does not delete a document referenced by a WhatsApp message attachment", async () => {
    const document = await seedDocument({ messageAttachmentCount: 1 });
    const response = await fetch(`${baseUrl}/api/admin/properties/21/documents/${document.id}`, {
        method: "DELETE",
        headers: authHeaders(users[0]),
    });
    assert.equal(response.status, 409);
    assert.equal(documents.length, 1);
    assert.equal(destroyedAssets.length, 0);
});
