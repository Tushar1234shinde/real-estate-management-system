import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { getCloudinaryEvidenceFolder } from "../src/config/cloudinary.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};

test("uses a production-safe default evidence folder and accepts isolated test prefixes", () => {
    assert.equal(getCloudinaryEvidenceFolder({}), "visit-evidence");
    assert.equal(getCloudinaryEvidenceFolder({ CLOUDINARY_EVIDENCE_FOLDER: "stage7c/unit-run" }), "stage7c/unit-run");
    assert.throws(
        () => getCloudinaryEvidenceFolder({ CLOUDINARY_EVIDENCE_FOLDER: "../production" }),
        /Evidence uploads are not configured/,
    );
});

const users = [
    { id: 1, fullName: "Admin User", email: "admin@example.com", isActive: true, role: { name: "ADMIN" } },
    { id: 4, fullName: "Outside User", email: "outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 5, fullName: "Other Outside User", email: "other-outside@example.com", isActive: true, role: { name: "OUTSIDE_SALES" } },
    { id: 2, fullName: "Executive User", email: "executive@example.com", isActive: true, role: { name: "EXECUTIVE" } },
];

const schedules = [
    {
        id: 101,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-10T09:00:00.000Z",
        customer: { id: 11, fullName: "Customer One", email: "one@example.com", phone: "1111111111" },
        property: { id: 21, title: "Property One", location: "Location One", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: null,
    },
    {
        id: 102,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-11T09:00:00.000Z",
        customer: { id: 12, fullName: "Customer Two", email: "two@example.com", phone: "2222222222" },
        property: { id: 22, title: "Property Two", location: "Location Two", latitude: null, longitude: null, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: null,
    },
    {
        id: 103,
        outsideSalesEmployeeId: 1,
        scheduledAt: "2026-11-09T09:00:00.000Z",
        customer: { id: 13, fullName: "Other Customer", email: "other@example.com", phone: "3333333333" },
        property: { id: 23, title: "Other Property", location: "Location Three", latitude: null, longitude: null, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: null,
    },
    {
        id: 104,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-12T09:00:00.000Z",
        customer: { id: 14, fullName: "GPS Customer", email: "gps@example.com", phone: "4444444444" },
        property: { id: 24, title: "GPS Property", location: "GPS Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 40, scheduleId: 104, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 105,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-13T09:00:00.000Z",
        customer: { id: 15, fullName: "Outside Customer", email: "outside-location@example.com", phone: "5555555555" },
        property: { id: 25, title: "Outside Property", location: "Outside Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 41, scheduleId: 105, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 106,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-14T09:00:00.000Z",
        customer: { id: 16, fullName: "Missing Coordinates", email: "missing-coordinates@example.com", phone: "6666666666" },
        property: { id: 26, title: "Unmapped Property", location: "Unmapped Location", latitude: null, longitude: null, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 42, scheduleId: 106, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 107,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-15T09:00:00.000Z",
        customer: { id: 17, fullName: "Accuracy Customer", email: "accuracy@example.com", phone: "7777777777" },
        property: { id: 27, title: "Accuracy Property", location: "Accuracy Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 43, scheduleId: 107, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 108,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-16T09:00:00.000Z",
        customer: { id: 18, fullName: "Reviewed Customer", email: "reviewed@example.com", phone: "8888888888" },
        property: { id: 28, title: "Reviewed Property", location: "Reviewed Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 44, scheduleId: 108, status: "PENDING_REVIEW", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 109,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-17T09:00:00.000Z",
        customer: { id: 19, fullName: "Concurrent Customer", email: "concurrent@example.com", phone: "9999999999" },
        property: { id: 29, title: "Concurrent Property", location: "Concurrent Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 45, scheduleId: 109, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: null, reachedLongitude: null, verificationResult: "PENDING", verificationCheckedAt: null, verificationDistanceMeters: null },
    },
    {
        id: 110,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-18T09:00:00.000Z",
        customer: { id: 20, fullName: "Evidence Customer", email: "evidence@example.com", phone: "1010101010" },
        property: { id: 30, title: "Evidence Property", location: "Evidence Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 46, scheduleId: 110, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: 12.1, reachedLongitude: 77.1, verificationResult: "PASSED", verificationCheckedAt: new Date(), verificationDistanceMeters: 0 },
    },
    {
        id: 111,
        outsideSalesEmployeeId: 4,
        scheduledAt: "2026-11-19T09:00:00.000Z",
        customer: { id: 21, fullName: "Concurrent Evidence", email: "concurrent-evidence@example.com", phone: "1111111112" },
        property: { id: 31, title: "Concurrent Evidence Property", location: "Evidence Location", latitude: 12.1, longitude: 77.1, verificationRadiusMeters: 200, status: "AVAILABLE" },
        visit: { id: 47, scheduleId: 111, status: "IN_PROGRESS", reachedAt: null, completedAt: null, reachedLatitude: 12.1, reachedLongitude: 77.1, verificationResult: "PASSED", verificationCheckedAt: new Date(), verificationDistanceMeters: 0 },
    },
];

let nextVisitId = 1;
let nextMediaId = 1;
let failNextMediaCreate = false;
let nextHistoryId = 1;
let failNextHistoryCreate = false;
const mediaAssets = [];
const visitStatusHistories = [];
const destroyedCloudinaryAssets = [];
const uploadedCloudinaryOptions = [];
const signedAccessRequests = [];
const cloudinaryClient = {
    uploader: {
        upload_stream(options, callback) {
            uploadedCloudinaryOptions.push(options);
            return {
                end(buffer) {
                    callback(null, {
                        public_id: options.public_id,
                        asset_id: `asset-${options.public_id}`,
                        resource_type: options.resource_type,
                        type: options.type,
                        secure_url: `https://res.cloudinary.com/test/${options.public_id}`,
                        bytes: buffer.length,
                        duration: options.resource_type === "video" ? 3.2 : undefined,
                    });
                },
            };
        },
        async destroy(publicId, options) {
            destroyedCloudinaryAssets.push({ publicId, options });
            return { result: "ok" };
        },
    },
    utils: {
        private_download_url(publicId, format, options) {
            signedAccessRequests.push({ publicId, format, options });
            return `https://example.invalid/download/${publicId}?expires_at=${options.expires_at}`;
        },
    },
};

const prismaClient = {
    user: {
        async findUnique({ where, select, include }) {
            return users.find((user) => user.id === where.id || user.email === where.email) ?? null;
        },
    },
    visitSchedule: {
        async findMany({ where, skip, take }) {
            return schedules
                .filter((schedule) => schedule.outsideSalesEmployeeId === where.outsideSalesEmployeeId)
                .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.id - right.id)
                .slice(skip, skip + take);
        },
        async count({ where }) {
            return schedules.filter((schedule) => schedule.outsideSalesEmployeeId === where.outsideSalesEmployeeId).length;
        },
        async findUnique({ where }) {
            return schedules.find((schedule) => schedule.id === where.id) ?? null;
        },
    },
    visit: {
        async create({ data }) {
            await Promise.resolve();
            const schedule = schedules.find((candidate) => candidate.id === data.scheduleId);

            if (schedule.visit) {
                const error = new Error("Unique constraint failed");
                error.code = "P2002";
                throw error;
            }

            const visit = {
                id: nextVisitId,
                scheduleId: data.scheduleId,
                status: "IN_PROGRESS",
                reachedAt: null,
                completedAt: null,
                reachedLatitude: null,
                reachedLongitude: null,
                verificationResult: "PENDING",
                verificationCheckedAt: null,
                verificationDistanceMeters: null,
            };
            nextVisitId += 1;
            schedule.visit = visit;
            return visit;
        },
        async findUnique({ where, select, include }) {
            const schedule = where.scheduleId
                ? schedules.find((candidate) => candidate.id === where.scheduleId)
                : schedules.find((candidate) => candidate.visit?.id === where.id);

            if (!schedule?.visit) {
                return null;
            }

            if (where.id && (select?.schedule || include)) {
                return {
                    ...schedule.visit,
                    schedule: {
                        ...schedule,
                        outsideSalesEmployee: users.find((user) => user.id === schedule.outsideSalesEmployeeId),
                    },
                    ...(include ? { mediaAssets: mediaAssets.filter((media) => media.visitId === schedule.visit.id) } : {}),
                };
            }
            return schedule.visit;
        },
        async findMany({ where, skip = 0, take = Number.MAX_SAFE_INTEGER }) {
            return schedules
                .filter((schedule) => schedule.visit && schedule.visit.status === where.status)
                .sort((left, right) => left.visit.id - right.visit.id)
                .slice(skip, skip + take)
                .map((schedule) => ({
                    ...schedule.visit,
                    schedule: {
                        ...schedule,
                        outsideSalesEmployee: users.find((user) => user.id === schedule.outsideSalesEmployeeId),
                    },
                    mediaAssets: mediaAssets.filter((media) => media.visitId === schedule.visit.id),
                }));
        },
        async count({ where }) {
            return schedules.filter((schedule) => schedule.visit?.status === where.status).length;
        },
        async updateMany({ where, data }) {
            const visit = schedules.find((schedule) => schedule.visit?.id === where.id)?.visit;

            if (!visit || Object.entries(where).some(([key, value]) => visit[key] !== value)) {
                return { count: 0 };
            }

            Object.assign(visit, data);
            return { count: 1 };
        },
    },
    mediaAsset: {
        async findFirst({ where }) {
            return mediaAssets.find((media) => Object.entries(where).every(([key, value]) => media[key] === value)) ?? null;
        },
        async create({ data }) {
            if (failNextMediaCreate) {
                failNextMediaCreate = false;
                throw new Error("Database write failed");
            }
            const media = { id: nextMediaId, ...data };
            nextMediaId += 1;
            mediaAssets.push(media);
            return media;
        },
        async count({ where }) {
            return mediaAssets.filter((media) => media.visitId === where.visitId && media.mediaType === where.mediaType).length;
        },
    },
    visitStatusHistory: {
        async create({ data }) {
            if (failNextHistoryCreate) {
                failNextHistoryCreate = false;
                throw new Error("History write failed");
            }
            const history = { id: nextHistoryId, ...data };
            nextHistoryId += 1;
            visitStatusHistories.push(history);
            return history;
        },
    },
    async $transaction(operations) {
        if (typeof operations !== "function") return Promise.all(operations);

        const visitSnapshots = schedules.map((schedule) => schedule.visit && { schedule, visit: { ...schedule.visit } });
        const historyLength = visitStatusHistories.length;
        try {
            return await operations(this);
        } catch (error) {
            visitSnapshots.filter(Boolean).forEach(({ schedule, visit }) => {
                Object.keys(schedule.visit).forEach((key) => {
                    if (!(key in visit)) delete schedule.visit[key];
                });
                Object.assign(schedule.visit, visit);
            });
            visitStatusHistories.splice(historyLength);
            throw error;
        }
    },
};

const app = createApp({ prismaClient, jwtConfig, cloudinaryClient });
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
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
}

test("lists only the authenticated Outside Sales employee's schedules with pagination", async () => {
    const response = await fetch(`${baseUrl}/api/outside-sales/visit-schedules?page=1&pageSize=1`, {
        headers: { Authorization: `Bearer ${tokenFor(users[1])}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.schedules.length, 1);
    assert.equal(body.data.schedules[0].id, 101);
    assert.equal(body.data.schedules[0].customer.id, 11);
    assert.equal(body.data.schedules[0].property.id, 21);
    assert.deepEqual(body.data.pagination, { page: 1, pageSize: 1, total: 10, totalPages: 10 });
});

test("rejects non-Outside Sales users and invalid schedule pagination", async () => {
    const forbidden = await fetch(`${baseUrl}/api/outside-sales/visit-schedules`, {
        headers: { Authorization: `Bearer ${tokenFor(users[0])}` },
    });
    const invalidPage = await fetch(`${baseUrl}/api/outside-sales/visit-schedules?page=0`, {
        headers: { Authorization: `Bearer ${tokenFor(users[1])}` },
    });
    const oversizedPage = await fetch(`${baseUrl}/api/outside-sales/visit-schedules?page=9007199254740991&pageSize=100`, {
        headers: { Authorization: `Bearer ${tokenFor(users[1])}` },
    });

    assert.equal(forbidden.status, 403);
    assert.equal(invalidPage.status, 400);
    assert.equal(oversizedPage.status, 400);
});

test("initializes one visit per owned schedule and handles concurrent creation", async () => {
    const authorization = { Authorization: `Bearer ${tokenFor(users[1])}` };
    const responses = await Promise.all([
        fetch(`${baseUrl}/api/visit-schedules/101/visit`, { method: "POST", headers: authorization }),
        fetch(`${baseUrl}/api/visit-schedules/101/visit`, { method: "POST", headers: authorization }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const statuses = responses.map((response) => response.status).sort();

    assert.deepEqual(statuses, [200, 201]);
    assert.equal(bodies[0].data.visit.id, bodies[1].data.visit.id);
    assert.equal(bodies.filter((body) => body.data.created).length, 1);

    const existing = await fetch(`${baseUrl}/api/visit-schedules/101/visit`, {
        method: "POST",
        headers: authorization,
    });
    const existingBody = await existing.json();

    assert.equal(existing.status, 200);
    assert.equal(existingBody.data.created, false);
});

test("rejects missing, invalid, and unowned schedule initialization", async () => {
    const authorization = { Authorization: `Bearer ${tokenFor(users[1])}` };
    const missing = await fetch(`${baseUrl}/api/visit-schedules/999/visit`, { method: "POST", headers: authorization });
    const invalid = await fetch(`${baseUrl}/api/visit-schedules/not-a-number/visit`, { method: "POST", headers: authorization });
    const unowned = await fetch(`${baseUrl}/api/visit-schedules/103/visit`, {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ outsideSalesEmployeeId: users[1].id }),
    });

    assert.equal(missing.status, 404);
    assert.equal(invalid.status, 400);
    assert.equal(unowned.status, 403);
});

function verifyVisit(visitId, user, body) {
    return fetch(`${baseUrl}/api/visits/${visitId}/verify-location`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokenFor(user)}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

const accurateLocation = { latitude: 12.1, longitude: 77.1, accuracy: 10 };

test("verifies an owned visit inside the configured property radius and is idempotent", async () => {
    const verified = await verifyVisit(40, users[1], accurateLocation);
    const verifiedBody = await verified.json();

    assert.equal(verified.status, 200);
    assert.equal(verifiedBody.data.verified, true);
    assert.equal(verifiedBody.data.visit.verificationResult, "PASSED");
    assert.equal(verifiedBody.data.visit.reachedLatitude, accurateLocation.latitude);
    assert.equal(verifiedBody.data.visit.reachedLongitude, accurateLocation.longitude);
    assert.ok(verifiedBody.data.visit.verificationDistanceMeters < 1);
    assert.ok(verifiedBody.data.visit.verificationCheckedAt);

    const repeated = await verifyVisit(40, users[1], { latitude: 13, longitude: 78, accuracy: 10 });
    const repeatedBody = await repeated.json();

    assert.equal(repeated.status, 200);
    assert.equal(repeatedBody.data.verified, false);
    assert.equal(repeatedBody.data.visit.verificationResult, "PASSED");
    assert.equal(repeatedBody.data.visit.reachedLatitude, accurateLocation.latitude);
});

test("records FAILED for an owned visit outside the property radius", async () => {
    const response = await verifyVisit(41, users[1], { latitude: 12.11, longitude: 77.1, accuracy: 10 });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.verified, true);
    assert.equal(body.data.visit.verificationResult, "FAILED");
    assert.ok(body.data.visit.verificationDistanceMeters > 200);
});

test("rejects missing property coordinates, invalid coordinates, and inaccurate GPS readings", async () => {
    const missingCoordinates = await verifyVisit(42, users[1], accurateLocation);
    const invalidCoordinates = await verifyVisit(43, users[1], { latitude: 91, longitude: 77.1, accuracy: 10 });
    const inaccurateReading = await verifyVisit(43, users[1], { ...accurateLocation, accuracy: 101 });

    assert.equal(missingCoordinates.status, 422);
    assert.match((await missingCoordinates.clone().json()).message, /coordinates are not configured/i);
    assert.equal(invalidCoordinates.status, 400);
    assert.equal(inaccurateReading.status, 400);
    assert.equal(schedules.find((schedule) => schedule.id === 107).visit.verificationResult, "PENDING");
});

test("rejects unauthorized and reviewed visit verification", async () => {
    const forbiddenRole = await verifyVisit(40, users[0], accurateLocation);
    const unauthorized = await verifyVisit(40, users[2], accurateLocation);
    const reviewed = await verifyVisit(44, users[1], accurateLocation);

    assert.equal(forbiddenRole.status, 403);
    assert.equal(unauthorized.status, 403);
    assert.equal(reviewed.status, 409);
});

test("allows only one concurrent verification update", async () => {
    const responses = await Promise.all([
        verifyVisit(45, users[1], accurateLocation),
        verifyVisit(45, users[1], { latitude: 12.1001, longitude: 77.1, accuracy: 10 }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(bodies.filter((body) => body.data.verified).length, 1);
    assert.equal(bodies[0].data.visit.reachedLatitude, bodies[1].data.visit.reachedLatitude);
});

function uploadEvidence(visitId, path, user, bytes, mimeType, filename = "evidence.bin") {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    return fetch(`${baseUrl}/api/visits/${visitId}/evidence/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenFor(user)}` },
        body: form,
    });
}

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);

test("uploads one authenticated selfie for a passed, owned visit and returns the existing selfie on retry", async () => {
    const uploaded = await uploadEvidence(46, "selfie", users[1], jpegBytes, "image/jpeg", "selfie.jpg");
    const uploadedBody = await uploaded.json();
    const duplicate = await uploadEvidence(46, "selfie", users[1], jpegBytes, "image/jpeg", "selfie.jpg");
    const duplicateBody = await duplicate.json();

    assert.equal(uploaded.status, 201);
    assert.equal(uploadedBody.data.created, true);
    assert.equal(uploadedBody.data.media.mediaType, "VISIT_SELFIE");
    assert.match(uploadedBody.data.media.fileUrl, /^https:/);
    assert.match(uploadedBody.data.media.publicId, /^selfie-/);
    assert.equal(uploadedBody.data.media.assetId, `asset-${uploadedBody.data.media.publicId}`);
    assert.equal(uploadedBody.data.media.resourceType, "image");
    assert.equal(uploadedBody.data.media.deliveryType, "authenticated");
    assert.equal(uploadedCloudinaryOptions.at(-1).folder, "visit-evidence/46");
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.data.created, false);
    assert.equal(duplicateBody.data.media.id, uploadedBody.data.media.id);
    assert.equal(mediaAssets.filter((media) => media.visitId === 46 && media.mediaType === "VISIT_SELFIE").length, 1);
});

test("handles concurrent duplicate selfie uploads without persisting a second selfie", async () => {
    const responses = await Promise.all([
        uploadEvidence(47, "selfie", users[1], jpegBytes, "image/jpeg", "concurrent-one.jpg"),
        uploadEvidence(47, "selfie", users[1], jpegBytes, "image/jpeg", "concurrent-two.jpg"),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
    assert.equal(bodies.filter((body) => body.data.created).length, 1);
    assert.equal(mediaAssets.filter((media) => media.visitId === 47 && media.mediaType === "VISIT_SELFIE").length, 1);
});

test("uploads multiple audio recordings for a passed, owned visit", async () => {
    const first = await uploadEvidence(46, "audio", users[1], mp3Bytes, "audio/mpeg", "first.mp3");
    const second = await uploadEvidence(46, "audio", users[1], mp3Bytes, "audio/mpeg", "second.mp3");

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(mediaAssets.filter((media) => media.visitId === 46 && media.mediaType === "AUDIO_RECORDING").length, 2);
    assert.equal(mediaAssets.find((media) => media.mediaType === "AUDIO_RECORDING").resourceType, "video");
    assert.equal(mediaAssets.find((media) => media.mediaType === "AUDIO_RECORDING").deliveryType, "authenticated");
});

test("rejects evidence uploads for unauthorized, unverified, invalid, and oversized files", async () => {
    const wrongOwner = await uploadEvidence(46, "selfie", users[2], jpegBytes, "image/jpeg");
    const wrongRole = await uploadEvidence(46, "selfie", users[0], jpegBytes, "image/jpeg");
    const failedVerification = await uploadEvidence(41, "audio", users[1], mp3Bytes, "audio/mpeg");
    const invalidSignature = await uploadEvidence(46, "selfie", users[1], new Uint8Array([1, 2, 3]), "image/jpeg");
    const oversized = await uploadEvidence(46, "selfie", users[1], new Uint8Array((5 * 1024 * 1024) + 1), "image/jpeg");

    assert.equal(wrongOwner.status, 403);
    assert.equal(wrongRole.status, 403);
    assert.equal(failedVerification.status, 409);
    assert.equal(invalidSignature.status, 400);
    assert.equal(oversized.status, 413);
});

test("cleans up Cloudinary evidence when database persistence fails", async () => {
    failNextMediaCreate = true;
    const response = await uploadEvidence(46, "audio", users[1], mp3Bytes, "audio/mpeg", "will-fail.mp3");

    assert.equal(response.status, 500);
    assert.equal(destroyedCloudinaryAssets.length > 0, true);
    assert.equal(destroyedCloudinaryAssets.at(-1).options.type, "authenticated");
    assert.equal(destroyedCloudinaryAssets.at(-1).options.resource_type, "video");
});

function submitVisit(visitId, user) {
    return fetch(`${baseUrl}/api/visits/${visitId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenFor(user)}` },
    });
}

function addSelfie(visitId) {
    const existing = mediaAssets.find((media) => media.visitId === visitId && media.mediaType === "VISIT_SELFIE");
    if (existing) return existing;
    const media = {
        id: nextMediaId,
        visitId,
        uploadedByUserId: users[1].id,
        mediaType: "VISIT_SELFIE",
        fileUrl: "https://res.cloudinary.com/test/submission-selfie",
        mimeType: "image/jpeg",
        fileSizeBytes: 10n,
        durationSeconds: null,
    };
    nextMediaId += 1;
    mediaAssets.push(media);
    return media;
}

test("submits a passed visit with exactly one selfie and no audio", async () => {
    const response = await submitVisit(47, users[1]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.visit.status, "PENDING_REVIEW");
    assert.equal(body.data.history.previousStatus, "IN_PROGRESS");
    assert.equal(body.data.history.newStatus, "PENDING_REVIEW");
    assert.equal(body.data.history.changedByUserId, users[1].id);
    assert.equal(mediaAssets.filter((media) => media.visitId === 47 && media.mediaType === "AUDIO_RECORDING").length, 0);
});

test("submits a passed visit with a selfie and optional audio recordings", async () => {
    const response = await submitVisit(46, users[1]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.visit.status, "PENDING_REVIEW");
    assert.equal(mediaAssets.filter((media) => media.visitId === 46 && media.mediaType === "AUDIO_RECORDING").length, 2);
});

test("rejects submission without a selfie or successful GPS verification", async () => {
    const missingSelfie = await submitVisit(45, users[1]);
    const failedVerification = await submitVisit(41, users[1]);

    assert.equal(missingSelfie.status, 409);
    assert.match((await missingSelfie.clone().json()).message, /exactly one visit selfie/i);
    assert.equal(failedVerification.status, 409);
    assert.match((await failedVerification.clone().json()).message, /verification must pass/i);
});

test("rejects submission by unauthorized roles, other employees, and invalid statuses", async () => {
    const wrongRole = await submitVisit(40, users[0]);
    const wrongOwner = await submitVisit(40, users[2]);
    const alreadySubmitted = await submitVisit(47, users[1]);
    const invalidStatus = await submitVisit(44, users[1]);

    assert.equal(wrongRole.status, 403);
    assert.equal(wrongOwner.status, 403);
    assert.equal(alreadySubmitted.status, 409);
    assert.equal(invalidStatus.status, 409);
});

test("creates one history record for concurrent duplicate submissions", async () => {
    addSelfie(45);
    const responses = await Promise.all([submitVisit(45, users[1]), submitVisit(45, users[1])]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(bodies.filter((body) => body.success).length, 1);
    assert.equal(visitStatusHistories.filter((history) => history.visitId === 45).length, 1);
});

test("rolls back the visit status when status-history creation fails", async () => {
    addSelfie(40);
    failNextHistoryCreate = true;
    const response = await submitVisit(40, users[1]);

    assert.equal(response.status, 500);
    assert.equal(schedules.find((schedule) => schedule.visit?.id === 40).visit.status, "IN_PROGRESS");
    assert.equal(visitStatusHistories.filter((history) => history.visitId === 40).length, 0);
});

function adminRequest(path, user, options = {}) {
    return fetch(`${baseUrl}/api/admin${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${tokenFor(user)}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        },
    });
}

test("allows ADMIN and EXECUTIVE users to list pending reviews with pagination", async () => {
    const adminResponse = await adminRequest("/visits/pending-review?page=1&pageSize=2", users[0]);
    const executiveResponse = await adminRequest("/visits/pending-review?page=2&pageSize=2", users[3]);
    const forbidden = await adminRequest("/visits/pending-review", users[2]);
    const adminBody = await adminResponse.json();
    const executiveBody = await executiveResponse.json();

    assert.equal(adminResponse.status, 200);
    assert.equal(executiveResponse.status, 200);
    assert.equal(forbidden.status, 403);
    assert.equal(adminBody.data.visits.length, 2);
    assert.equal(adminBody.data.visits.every((visit) => visit.status === "PENDING_REVIEW"), true);
    assert.deepEqual(adminBody.data.pagination, { page: 1, pageSize: 2, total: 4, totalPages: 2 });
    assert.equal(executiveBody.data.visits.length, 2);
});

test("denies Outside Sales users access to every review endpoint", async () => {
    const detail = await adminRequest("/visits/46/review", users[1]);
    const approve = await adminRequest("/visits/46/approve", users[1], { method: "PATCH" });
    const reject = await adminRequest("/visits/46/reject", users[1], {
        method: "PATCH",
        body: JSON.stringify({ rejectionReason: "Not authorized." }),
    });

    assert.equal(detail.status, 403);
    assert.equal(approve.status, 403);
    assert.equal(reject.status, 403);
});

test("returns review details with schedule, GPS, selfie, and audio metadata", async () => {
    const response = await adminRequest("/visits/46/review", users[0]);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.visit.schedule.customer.id, 20);
    assert.equal(body.data.visit.schedule.property.id, 30);
    assert.equal(body.data.visit.schedule.outsideSalesEmployee.id, users[1].id);
    assert.equal(body.data.visit.verificationResult, "PASSED");
    assert.equal(body.data.visit.mediaAssets.filter((media) => media.mediaType === "VISIT_SELFIE").length, 1);
    assert.equal(body.data.visit.mediaAssets.filter((media) => media.mediaType === "AUDIO_RECORDING").length, 2);
    assert.equal("passwordHash" in body.data.visit.schedule.outsideSalesEmployee, false);
});

test("generates short-lived signed evidence access only for Admin and Executive users", async () => {
    const selfie = mediaAssets.find((media) => media.visitId === 46 && media.mediaType === "VISIT_SELFIE");
    const before = Math.floor(Date.now() / 1000);
    const admin = await adminRequest(`/visits/46/evidence/${selfie.id}/access`, users[0]);
    const executive = await adminRequest(`/visits/46/evidence/${selfie.id}/access`, users[3]);
    const outside = await adminRequest(`/visits/46/evidence/${selfie.id}/access`, users[1]);
    const missing = await adminRequest(`/visits/46/evidence/999999/access`, users[0]);
    const adminBody = await admin.json();

    assert.equal(admin.status, 200);
    assert.equal(executive.status, 200);
    assert.equal(outside.status, 403);
    assert.equal(missing.status, 404);
    assert.match(adminBody.data.accessUrl, /^https:\/\/example\.invalid\/download\//);
    assert.ok(adminBody.data.expiresAt >= before + 299 && adminBody.data.expiresAt <= before + 301);
    assert.equal(signedAccessRequests.at(-1).options.type, "authenticated");
    assert.equal(signedAccessRequests.at(-1).options.resource_type, "image");
    assert.equal(signedAccessRequests.at(-1).format, "jpg");
});

test("rejects evidence access when Cloudinary metadata or expiry configuration is invalid", async () => {
    const incomplete = { id: nextMediaId, visitId: 46, mediaType: "OTHER", mimeType: "image/jpeg", publicId: null, resourceType: null, deliveryType: null };
    nextMediaId += 1;
    mediaAssets.push(incomplete);
    const response = await adminRequest(`/visits/46/evidence/${incomplete.id}/access`, users[0]);

    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /metadata is incomplete/i);
});

test("approves and rejects pending visits while recording the reviewer", async () => {
    const approved = await adminRequest("/visits/46/approve", users[0], { method: "PATCH" });
    const rejected = await adminRequest("/visits/47/reject", users[3], {
        method: "PATCH",
        body: JSON.stringify({ rejectionReason: "Selfie does not clearly show the property." }),
    });
    const approvedBody = await approved.json();
    const rejectedBody = await rejected.json();

    assert.equal(approved.status, 200);
    assert.equal(approvedBody.data.visit.status, "COMPLETED");
    assert.equal(approvedBody.data.history.changedByUserId, users[0].id);
    assert.equal(rejected.status, 200);
    assert.equal(rejectedBody.data.visit.status, "REJECTED");
    assert.equal(rejectedBody.data.visit.rejectionReason, "Selfie does not clearly show the property.");
    assert.equal(rejectedBody.data.history.changedByUserId, users[3].id);
});

test("rejects empty rejection reasons and review decisions for invalid statuses", async () => {
    const missingReason = await adminRequest("/visits/45/reject", users[0], {
        method: "PATCH",
        body: JSON.stringify({ rejectionReason: "   " }),
    });
    const invalidStatus = await adminRequest("/visits/40/approve", users[0], { method: "PATCH" });

    assert.equal(missingReason.status, 400);
    assert.equal(invalidStatus.status, 409);
});

test("allows only one concurrent review decision and history entry", async () => {
    const responses = await Promise.all([
        adminRequest("/visits/45/approve", users[0], { method: "PATCH" }),
        adminRequest("/visits/45/reject", users[3], {
            method: "PATCH",
            body: JSON.stringify({ rejectionReason: "Concurrent rejection." }),
        }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(bodies.filter((body) => body.success).length, 1);
    assert.equal(visitStatusHistories.filter((history) => history.visitId === 45 && history.previousStatus === "PENDING_REVIEW").length, 1);
});

test("rolls back a review decision when history creation fails", async () => {
    failNextHistoryCreate = true;
    const response = await adminRequest("/visits/44/approve", users[0], { method: "PATCH" });

    assert.equal(response.status, 500);
    const visit = schedules.find((schedule) => schedule.visit?.id === 44).visit;
    assert.equal(visit.status, "PENDING_REVIEW");
    assert.equal(visit.reviewerId, undefined);
    assert.equal(visitStatusHistories.filter((history) => history.visitId === 44 && history.newStatus === "COMPLETED").length, 0);
});
