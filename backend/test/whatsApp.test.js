import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { AppError } from "../src/errors/AppError.js";
import { createWhatsAppOutboxDispatcher } from "../src/dispatchers/whatsAppOutboxDispatcher.js";
import { createMetaWhatsAppClient } from "../src/integrations/metaWhatsApp.js";
import {
    reconcileUnmatchedWhatsAppStatusEvents,
    verifyMetaWebhookSignature,
} from "../src/controllers/whatsAppController.js";

const jwtConfig = {
    secret: crypto.randomBytes(32).toString("base64url"),
    expiresIn: "1h",
    issuer: "test-real-estate-api",
    audience: "test-real-estate-client",
};
const appSecret = "test-meta-app-secret";
const environment = {
    META_WHATSAPP_ACCESS_TOKEN: "test-access-token",
    META_WHATSAPP_PHONE_NUMBER_ID: "123456789",
    META_WHATSAPP_VERIFY_TOKEN: "test-verify-token",
    META_WHATSAPP_APP_SECRET: appSecret,
    META_GRAPH_API_VERSION: "v99.0",
};
const users = [
    { id: 1, isActive: true, role: { name: "INSIDE_SALES" } },
    { id: 2, isActive: true, role: { name: "INSIDE_SALES" } },
    { id: 3, isActive: true, role: { name: "ADMIN" } },
    { id: 4, isActive: true, role: { name: "EXECUTIVE" } },
    { id: 5, isActive: true, role: { name: "OUTSIDE_SALES" } },
];
const customers = [
    { id: 11, phone: "+14155550111", assignment: { insideSalesEmployeeId: 1 }, lastWhatsappInboundAt: new Date() },
    { id: 12, phone: "+14155550112", assignment: { insideSalesEmployeeId: 2 }, lastWhatsappInboundAt: new Date() },
    { id: 13, phone: "+14155550113", assignment: null, lastWhatsappInboundAt: new Date() },
    { id: 14, phone: "+14155550114", assignment: null, lastWhatsappInboundAt: new Date() },
    { id: 15, phone: "+14155550115", assignment: null, lastWhatsappInboundAt: new Date() },
    { id: 16, phone: "+14155550116", assignment: null, lastWhatsappInboundAt: new Date(Date.now() - 60_000) },
    { id: 17, phone: "+14155550117", assignment: null, lastWhatsappInboundAt: new Date() },
];
const consentEvents = [];
const messages = [];
const outboxRecords = [];
const idempotencyRecords = [];
const statusEvents = [];
const pendingStatusEvents = [];
const inboundEvents = [];
let nextMessageId = 1;
let nextOutboxId = 1;
let nextIdempotencyId = 1;
let nextConsentId = 1;
let nextStatusEventId = 1;
let nextInboundEventId = 1;
let providerFailure = false;
let providerOutcomeUnknown = false;
let failOutboxCreate = false;
let failNextTransaction = false;
let failStatusReconcile = false;
let hideExistingIdempotencyOnce = false;
let snapshotNextTransaction = false;
let earlyStatusForNextSend = null;
let lastProviderRequest;
let lastProviderMockError;
let providerCalls = 0;
let nextProviderMessageNumber = 1;
let inboundWindowUpdateCount = 0;
let lockPause;
let onLockAttempt;
let customer12StopTimestamp;
const lockTails = new Map();
const activeCustomerLocks = new Set();

async function acquireCustomerLock(customerId) {
    const key = `customer:${customerId}`;
    onLockAttempt?.(customerId);
    const previous = lockTails.get(key) ?? Promise.resolve();
    let releaseGate;
    const gate = new Promise((resolve) => { releaseGate = resolve; });
    const tail = previous.then(() => gate);
    lockTails.set(key, tail);
    await previous;
    activeCustomerLocks.add(key);
    return () => {
        activeCustomerLocks.delete(key);
        releaseGate();
        if (lockTails.get(key) === tail) {
            tail.then(() => {
                if (lockTails.get(key) === tail) lockTails.delete(key);
            });
        }
    };
}

const prismaClient = {
    user: {
        async findUnique({ where }) {
            return users.find((user) => user.id === where.id) ?? null;
        },
    },
    customer: {
        async findFirst({ where }) {
            const customer = customers.find((candidate) => {
                if (candidate.id !== where.id) return false;
                const ownerId = where.assignment?.is?.insideSalesEmployeeId;
                return ownerId === undefined || candidate.assignment?.insideSalesEmployeeId === ownerId;
            });
            return customer ? { id: customer.id, phone: customer.phone, lastWhatsappInboundAt: customer.lastWhatsappInboundAt } : null;
        },
        async findUnique({ where }) {
            const customer = customers.find((candidate) => candidate.id === where.id);
            return customer ? {
                id: customer.id,
                phone: customer.phone,
                lastWhatsappInboundAt: customer.lastWhatsappInboundAt,
            } : null;
        },
        async findMany({ where, take }) {
            return customers.filter((customer) => where.OR.some((condition) => customer.phone === condition.phone))
                .slice(0, take)
                .map(({ id }) => ({ id }));
        },
        async updateMany({ where, data }) {
            const customer = customers.find((candidate) => candidate.id === where.id);
            if (!customer) return { count: 0 };
            const allowed = where.OR.some((condition) => condition.lastWhatsappInboundAt === null
                ? customer.lastWhatsappInboundAt === null
                : customer.lastWhatsappInboundAt < condition.lastWhatsappInboundAt.lt);
            if (!allowed) return { count: 0 };
            Object.assign(customer, data);
            inboundWindowUpdateCount += 1;
            return { count: 1 };
        },
    },
    whatsAppConsentEvent: {
        async findFirst({ where }) {
            const consent = consentEvents
                .filter((event) => event.customerId === where.customerId)
                .sort((left, right) => right.recordedAt - left.recordedAt || right.id - left.id)[0];
            if (!consent) return null;
            const inboundEvent = inboundEvents.find((event) => event.id === consent.inboundMessageEventId);
            return {
                ...consent,
                inboundMessageEvent: inboundEvent ? { providerTimestamp: inboundEvent.providerTimestamp } : null,
            };
        },
        async create({ data }) {
            const event = {
                id: nextConsentId++,
                ...data,
                consentAt: data.consentAt ?? new Date(),
                recordedAt: data.recordedAt ?? new Date(),
            };
            consentEvents.push(event);
            return event;
        },
    },
    whatsAppInboundMessageEvent: {
        async findUnique({ where }) {
            return inboundEvents.find((event) => event.providerMessageId === where.providerMessageId) ?? null;
        },
        async create({ data }) {
            if (inboundEvents.some((event) => event.providerMessageId === data.providerMessageId)) {
                throw { code: "P2002" };
            }
            const event = { id: nextInboundEventId++, ...data, receivedAt: new Date() };
            inboundEvents.push(event);
            return event;
        },
    },
    whatsAppMessageLog: {
        async create({ data }) {
            const message = { id: nextMessageId++, ...data, sentAt: null, statusUpdatedAt: null, createdAt: new Date() };
            messages.push(message);
            return message;
        },
        async update({ where, data }) {
            const message = messages.find((candidate) => candidate.id === where.id);
            if (!message) throw new Error("Message not found");
            Object.assign(message, data);
            return message;
        },
        async updateMany({ where, data }) {
            const message = messages.find((candidate) => candidate.id === where.id
                && (where.providerMessageId === undefined || candidate.providerMessageId === where.providerMessageId));
            if (!message) return { count: 0 };
            Object.assign(message, data);
            return { count: 1 };
        },
        async findMany({ where, skip, take }) {
            return messages
                .filter((message) => message.customerId === where.customerId)
                .sort((left, right) => right.createdAt - left.createdAt || right.id - left.id)
                .slice(skip, skip + take)
                .map((message) => ({
                    ...message,
                    outbox: outboxRecords.find((record) => record.messageLogId === message.id)
                        ? {
                            status: outboxRecords.find((record) => record.messageLogId === message.id).status,
                            attemptCount: outboxRecords.find((record) => record.messageLogId === message.id).attemptCount,
                        }
                        : null,
                }));
        },
        async count({ where }) {
            return messages.filter((message) => message.customerId === where.customerId).length;
        },
        async findUnique({ where }) {
            return messages.find((message) => where.id !== undefined
                ? message.id === where.id
                : message.providerMessageId === where.providerMessageId) ?? null;
        },
    },
    whatsAppMessageIdempotency: {
        async findUnique({ where }) {
            if (hideExistingIdempotencyOnce) {
                hideExistingIdempotencyOnce = false;
                return null;
            }
            const key = where.senderUserId_customerId_idempotencyKey;
            const record = idempotencyRecords.find((candidate) => candidate.senderUserId === key.senderUserId
                && candidate.customerId === key.customerId
                && candidate.idempotencyKey === key.idempotencyKey);
            if (!record) return null;
            const message = messages.find((candidate) => candidate.id === record.messageLogId);
            const outbox = outboxRecords.find((candidate) => candidate.messageLogId === record.messageLogId);
            return {
                payloadFingerprint: record.payloadFingerprint,
                messageLog: {
                    ...message,
                    outbox: outbox ? { status: outbox.status, attemptCount: outbox.attemptCount } : null,
                },
            };
        },
        async create({ data }) {
            if (idempotencyRecords.some((record) => record.senderUserId === data.senderUserId
                && record.customerId === data.customerId
                && record.idempotencyKey === data.idempotencyKey)) {
                throw { code: "P2002" };
            }
            const record = { id: nextIdempotencyId++, ...data, createdAt: new Date() };
            idempotencyRecords.push(record);
            return record;
        },
    },
    whatsAppMessageOutbox: {
        async create({ data }) {
            if (failOutboxCreate) throw new Error("Injected outbox create failure");
            const record = {
                id: nextOutboxId++,
                status: "PENDING",
                claimToken: null,
                attemptCount: 0,
                nextAttemptAt: new Date(),
                processingStartedAt: null,
                submissionStartedAt: null,
                completedAt: null,
                lastErrorCode: null,
                createdAt: new Date(),
                ...data,
            };
            outboxRecords.push(record);
            return record;
        },
        async findFirst({ where }) {
            const now = new Date();
            const record = outboxRecords
                .filter((candidate) => candidate.status === where.status
                    && candidate.nextAttemptAt <= now)
                .sort((left, right) => left.createdAt - right.createdAt || left.id - right.id)[0];
            if (!record) return null;
            return {
                id: record.id,
                messageLogId: record.messageLogId,
                messageLog: {
                    customerId: messages.find((message) => message.id === record.messageLogId).customerId,
                },
            };
        },
        async findMany({ where }) {
            return outboxRecords
                .filter((record) => record.status === where.status
                    && record.processingStartedAt instanceof Date
                    && record.processingStartedAt < where.processingStartedAt.lt)
                .map(({ id, messageLogId, attemptCount }) => ({ id, messageLogId, attemptCount }));
        },
        async findUnique({ where }) {
            return outboxRecords.find((record) => where.id !== undefined
                ? record.id === where.id
                : record.messageLogId === where.messageLogId) ?? null;
        },
        async updateMany({ where, data }) {
            const matched = outboxRecords.filter((record) => {
                if (where.id !== undefined && record.id !== where.id) return false;
                if (where.status !== undefined && record.status !== where.status) return false;
                if (where.claimToken !== undefined && record.claimToken !== where.claimToken) return false;
                if (where.processingStartedAt?.lt
                    && !(record.processingStartedAt instanceof Date && record.processingStartedAt < where.processingStartedAt.lt)) return false;
                if (where.submissionStartedAt?.lt
                    && !(record.submissionStartedAt instanceof Date && record.submissionStartedAt < where.submissionStartedAt.lt)) return false;
                if (where.nextAttemptAt?.lte
                    && !(record.nextAttemptAt instanceof Date && record.nextAttemptAt <= where.nextAttemptAt.lte)) return false;
                return true;
            });
            for (const record of matched) {
                for (const [key, value] of Object.entries(data)) {
                    record[key] = key === "attemptCount" && value?.increment !== undefined
                        ? record.attemptCount + value.increment
                        : value;
                }
            }
            return { count: matched.length };
        },
    },
    whatsAppPendingStatusEvent: {
        async create({ data }) {
            const duplicate = pendingStatusEvents.some((event) => event.providerMessageId === data.providerMessageId
                && event.status === data.status
                && event.providerTimestamp.getTime() === data.providerTimestamp.getTime());
            if (duplicate) throw { code: "P2002" };
            const event = { id: pendingStatusEvents.length + 1, ...data, receivedAt: new Date() };
            pendingStatusEvents.push(event);
            return event;
        },
        async findMany({ where }) {
            return pendingStatusEvents
                .filter((event) => event.providerMessageId === where.providerMessageId)
                .sort((left, right) => left.providerTimestamp - right.providerTimestamp || left.id - right.id)
                .map((event) => ({ ...event }));
        },
        async findFirst({ where }) {
            return pendingStatusEvents.find((event) => event.providerMessageId === where.providerMessageId) ?? null;
        },
        async deleteMany({ where }) {
            if (failStatusReconcile) {
                failStatusReconcile = false;
                throw new Error("Injected status reconciliation failure");
            }
            const before = pendingStatusEvents.length;
            for (let index = pendingStatusEvents.length - 1; index >= 0; index -= 1) {
                if (pendingStatusEvents[index].providerMessageId === where.providerMessageId) {
                    pendingStatusEvents.splice(index, 1);
                }
            }
            return { count: before - pendingStatusEvents.length };
        },
    },
    whatsAppMessageStatusEvent: {
        async findUnique({ where }) {
            const key = where.messageLogId_status_providerTimestamp;
            return statusEvents.find((event) => event.messageLogId === key.messageLogId
                && event.status === key.status
                && event.providerTimestamp.getTime() === key.providerTimestamp.getTime()) ?? null;
        },
        async create({ data }) {
            const duplicate = statusEvents.some((event) => event.messageLogId === data.messageLogId
                && event.status === data.status
                && event.providerTimestamp.getTime() === data.providerTimestamp.getTime());
            if (duplicate) throw { code: "P2002" };
            const event = { id: nextStatusEventId++, ...data, receivedAt: new Date() };
            statusEvents.push(event);
            return event;
        },
    },
};

prismaClient.$transaction = async (operation) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    if (failNextTransaction) {
        failNextTransaction = false;
        throw new Error("Injected transaction failure");
    }
    const snapshot = failOutboxCreate || failStatusReconcile || snapshotNextTransaction ? {
        messages: messages.map((record) => ({ ...record })),
        outboxRecords: outboxRecords.map((record) => ({ ...record })),
        idempotencyRecords: idempotencyRecords.map((record) => ({ ...record })),
        statusEvents: statusEvents.map((record) => ({ ...record })),
        pendingStatusEvents: pendingStatusEvents.map((record) => ({ ...record })),
    } : null;
    const releases = [];
    const lockedCustomers = new Set();
    const transaction = {
        ...prismaClient,
        async $queryRaw(strings, ...values) {
            const customerId = values[0];
            if (!lockedCustomers.has(customerId)) {
                lockedCustomers.add(customerId);
                releases.push(await acquireCustomerLock(customerId));
                if (lockPause?.customerId === customerId) {
                    const pause = lockPause;
                    lockPause = null;
                    pause.acquired();
                    await pause.wait;
                }
            }
            return [{ id: customerId }];
        },
    };
    try {
        return await operation(transaction);
    } catch (error) {
        if (snapshot) {
            messages.splice(0, messages.length, ...snapshot.messages);
            outboxRecords.splice(0, outboxRecords.length, ...snapshot.outboxRecords);
            idempotencyRecords.splice(0, idempotencyRecords.length, ...snapshot.idempotencyRecords);
            statusEvents.splice(0, statusEvents.length, ...snapshot.statusEvents);
            pendingStatusEvents.splice(0, pendingStatusEvents.length, ...snapshot.pendingStatusEvents);
        }
        throw error;
    } finally {
        releases.reverse().forEach((release) => release());
    }
};

function tokenFor(userId) {
    return jwt.sign({ sub: String(userId) }, jwtConfig.secret, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
    });
}

function createTestApp({ provider, env = environment } = {}) {
    return createApp({
        prismaClient,
        jwtConfig,
        environment: env,
        metaWhatsAppClient: provider ?? {
            async sendTextMessage(input) {
                providerCalls += 1;
                lastProviderRequest = input;
                if (providerFailure) throw new AppError(503, "Meta WhatsApp is temporarily unavailable.");
                return { providerMessageId: `wamid.${messages.length}` };
            },
        },
    });
}

const outboxDispatcher = createWhatsAppOutboxDispatcher({
    prismaClient,
    metaWhatsAppClient: {
        async sendTextMessage(input) {
            lastProviderMockError = null;
            assert.equal(activeCustomerLocks.size, 0);
            providerCalls += 1;
            lastProviderRequest = input;
            if (providerFailure) {
                const error = new AppError(502, "Meta WhatsApp rejected the message.");
                error.dispatchOutcome = "FAILED";
                throw error;
            }
            if (providerOutcomeUnknown) {
                const error = new AppError(503, "Meta WhatsApp is temporarily unavailable.");
                error.dispatchOutcome = "UNKNOWN";
                throw error;
            }
            const providerMessageId = `wamid.test.${nextProviderMessageNumber++}`;
            try {
                if (earlyStatusForNextSend) {
                    const events = earlyStatusForNextSend;
                    earlyStatusForNextSend = null;
                    for (const event of events) {
                        const webhook = await postWebhook(statusWebhookPayload(providerMessageId, event));
                        assert.equal(webhook.status, 200);
                        assert.equal(pendingStatusEvents.some((pending) => pending.providerMessageId === providerMessageId
                            && pending.status === event.status.toUpperCase()), true, JSON.stringify({
                            providerMessageId,
                            event,
                            pendingStatusEvents,
                        }));
                    }
                }
            } catch (error) {
                lastProviderMockError = error;
                throw error;
            }
            return { providerMessageId };
        },
    },
});

async function listen(app) {
    const server = await new Promise((resolve) => {
        const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

let server;
let baseUrl;

before(async () => {
    ({ server, baseUrl } = await listen(createTestApp()));
});

after(async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function authorizedOptions(userId, options = {}) {
    return {
        ...options,
        headers: {
            Authorization: `Bearer ${tokenFor(userId)}`,
            ...(options.headers ?? {}),
        },
    };
}

function sendOptions(userId, messageContent, idempotencyKey) {
    return authorizedOptions(userId, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({ messageContent }),
    });
}

function signatureFor(body) {
    return `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
}

async function postWebhook(payload, signature = true) {
    const body = JSON.stringify(payload);
    return postRawWebhook(body, signature);
}

async function postRawWebhook(body, signature = true) {
    return fetch(`${baseUrl}/api/webhooks/whatsapp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(signature ? { "X-Hub-Signature-256": signatureFor(body) } : {}),
        },
        body,
    });
}

function inboundPayload({ id, from, text, type = "text", timestamp = Math.floor(Date.now() / 1000) - 1 }) {
    const message = { id, from, timestamp: String(timestamp), type };
    if (type === "text") message.text = { body: text };
    return {
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    metadata: { phone_number_id: environment.META_WHATSAPP_PHONE_NUMBER_ID },
                    messages: [message],
                },
            }],
        }],
    };
}

function statusWebhookPayload(id, { status, timestamp = Math.floor(Date.now() / 1000), errors } = {}) {
    const statusEvent = { id, status, timestamp: String(timestamp) };
    if (errors) statusEvent.errors = errors;
    return {
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    metadata: { phone_number_id: environment.META_WHATSAPP_PHONE_NUMBER_ID },
                    statuses: [statusEvent],
                },
            }],
        }],
    };
}

async function postInbound(options) {
    return postWebhook(inboundPayload(options));
}

function pauseNextCustomerLock(customerId) {
    let markAcquired;
    let release;
    const acquired = new Promise((resolve) => { markAcquired = resolve; });
    const wait = new Promise((resolve) => { release = resolve; });
    lockPause = { customerId, acquired: markAcquired, wait };
    return { acquired, release };
}

test("validates Meta configuration and sends text with a bearer token", async () => {
    let request;
    const client = createMetaWhatsAppClient({
        environment,
        fetchImpl: async (url, options) => {
            request = { url, options };
            return { ok: true, status: 200, async json() { return { messages: [{ id: "wamid.accepted" }] }; } };
        },
    });

    assert.deepEqual(await client.sendTextMessage({ to: "14155550111", message: "Hello" }), {
        providerMessageId: "wamid.accepted",
    });
    assert.equal(request.url, "https://graph.facebook.com/v99.0/123456789/messages");
    assert.equal(request.options.headers.Authorization, "Bearer test-access-token");
    assert.deepEqual(JSON.parse(request.options.body), {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "14155550111",
        type: "text",
        text: { body: "Hello", preview_url: false },
    });
});

test("handles missing credentials and provider failures without exposing provider details", async () => {
    const missingConfigClient = createMetaWhatsAppClient({ environment: {} });
    await assert.rejects(
        missingConfigClient.sendTextMessage({ to: "14155550111", message: "Hello" }),
        (error) => error.statusCode === 503 && !error.message.includes("META_WHATSAPP"),
    );

    const failingClient = createMetaWhatsAppClient({
        environment,
        fetchImpl: async () => ({
            ok: false,
            status: 400,
            async json() { return { error: { message: "sensitive provider detail" } }; },
        }),
    });
    await assert.rejects(
        failingClient.sendTextMessage({ to: "14155550111", message: "Hello" }),
        (error) => error.statusCode === 502
            && error.dispatchOutcome === "FAILED"
            && !error.message.includes("sensitive provider detail"),
    );
    const disconnectedClient = createMetaWhatsAppClient({
        environment,
        fetchImpl: async () => { throw new Error("network detail"); },
    });
    await assert.rejects(
        disconnectedClient.sendTextMessage({ to: "14155550111", message: "Hello" }),
        (error) => error.statusCode === 503 && error.dispatchOutcome === "UNKNOWN",
    );
});

test("requires explicit consent and a recent inbound message before free-form text", async () => {
    await postInbound({ id: "wamid.window-consent", from: "14155550111", text: "START" });
    const noConsent = await fetch(`${baseUrl}/api/admin/customers/14/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    const expiredWindowCustomer = customers[0];
    const previousInbound = expiredWindowCustomer.lastWhatsappInboundAt;
    expiredWindowCustomer.lastWhatsappInboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const expiredWindow = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    expiredWindowCustomer.lastWhatsappInboundAt = new Date(Date.now() + 10 * 60 * 1000);
    const futureInbound = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    expiredWindowCustomer.lastWhatsappInboundAt = previousInbound;

    assert.equal(noConsent.status, 409);
    assert.equal(expiredWindow.status, 409);
    assert.equal(futureInbound.status, 409);
});

test("records consent and sends only to the stored assigned customer phone", async () => {
    const optInResponse = await postInbound({
        id: "wamid.customer-start",
        from: "14155550111",
        text: "  ＳＴＡＲＴ!!! ",
    });

    const response = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "  Hello customer  " }),
    }));
    const body = await response.json();
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(optInResponse.status, 200);
    assert.equal(response.status, 202);
    assert.equal(body.data.message.deliveryStatus, "PENDING");
    assert.equal(body.data.message.outbox.status, "PENDING");
    assert.equal(body.data.queued, true);
    assert.equal(body.data.acceptedByProvider, false);
    assert.equal(dispatch.status, "SENT");
    assert.equal(outboxRecords.at(-1).status, "SENT");
    assert.equal(messages.at(-1).messageContent, "Hello customer");
    assert.equal(messages.at(-1).triggeredByUserId, 1);
    assert.match(messages.at(-1).providerMessageId, /^wamid\.test\./);
    assert.deepEqual(lastProviderRequest, { to: "14155550111", message: "Hello customer" });
    assert.equal(consentEvents.find((event) => event.customerId === 11).source, "WHATSAPP_KEYWORD_START");
    assert.equal(consentEvents.find((event) => event.customerId === 11).recordedByUserId, null);
    assert.equal(JSON.stringify(body).includes("test-access-token"), false);

    const delivery = await postWebhook({
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    metadata: { phone_number_id: environment.META_WHATSAPP_PHONE_NUMBER_ID },
                    statuses: [{
                        id: messages.at(-1).providerMessageId,
                        status: "delivered",
                        timestamp: String(Math.floor(Date.now() / 1000)),
                    }],
                },
            }],
        }],
    });
    assert.equal(delivery.status, 200);
    assert.equal(messages.at(-1).deliveryStatus, "DELIVERED");
});

test("allows Executive customer access and enforces the latest opt-out", async () => {
    await postInbound({ id: "wamid.executive-start", from: "14155550113", text: "START" });
    const executiveSend = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(4, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Executive follow-up" }),
    }));
    const optOut = await fetch(`${baseUrl}/api/admin/customers/14/whatsapp-consent`, authorizedOptions(3, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consented: false, source: "CUSTOMER_REQUEST" }),
    }));
    const blockedSend = await fetch(`${baseUrl}/api/admin/customers/14/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Follow-up" }),
    }));
    await outboxDispatcher.dispatchOnce();

    assert.equal(executiveSend.status, 202);
    assert.equal(messages.at(-1).triggeredByUserId, 4);
    assert.equal(optOut.status, 201);
    assert.equal(blockedSend.status, 409);
});

test("normalizes exact opt-out keywords and records one opt-out for repeated STOP messages", async () => {
    const before = consentEvents.filter((event) => event.customerId === 12).length;
    const normalMessage = await postInbound({
        id: "wamid.not-a-command",
        from: "14155550112",
        text: "Please STOP contacting me later",
    });
    const arbitraryOptIn = await postInbound({
        id: "wamid.not-an-opt-in",
        from: "14155550112",
        text: "Please START messaging me later",
    });
    customer12StopTimestamp = Math.floor(Date.now() / 1000) - 30;
    const stopMessage = inboundPayload({
        id: "wamid.stop-customer-12",
        from: "14155550112",
        text: "  ＳＴＯＰ!!! ",
        timestamp: customer12StopTimestamp,
    });
    const firstStop = await postWebhook(stopMessage);
    const duplicateStop = await postWebhook(stopMessage);
    const repeatedStop = await postInbound({
        id: "wamid.stop-customer-12-repeat",
        from: "14155550112",
        text: "UNSUBSCRIBE.",
        timestamp: customer12StopTimestamp + 1,
    });

    assert.equal(normalMessage.status, 200);
    assert.equal(arbitraryOptIn.status, 200);
    assert.equal(firstStop.status, 200);
    assert.equal(duplicateStop.status, 200);
    assert.equal(repeatedStop.status, 200);
    assert.equal(inboundEvents.find((event) => event.providerMessageId === "wamid.not-a-command").processingClassification, "NORMAL");
    assert.equal(inboundEvents.find((event) => event.providerMessageId === "wamid.not-an-opt-in").processingClassification, "NORMAL");
    assert.equal(inboundEvents.filter((event) => event.providerMessageId === "wamid.stop-customer-12").length, 1);
    assert.equal(consentEvents.filter((event) => event.customerId === 12).length, before + 1);
    assert.equal(consentEvents.at(-1).status, "OPTED_OUT");
    assert.equal(consentEvents.at(-1).source, "WHATSAPP_KEYWORD_STOP");
    assert.equal(consentEvents.at(-1).recordedByUserId, null);
});

test("ordinary employees cannot reverse opt-out; customer START explicitly reconsents", async () => {
    const providerCallsBefore = providerCalls;
    const staleReconsent = await postInbound({
        id: "wamid.stale-start-customer-12",
        from: "14155550112",
        text: "START",
        timestamp: customer12StopTimestamp,
    });
    const ordinaryOptIn = await fetch(`${baseUrl}/api/inside-sales/customers/12/whatsapp-consent`, authorizedOptions(2, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consented: true, source: "CUSTOMER_REQUEST" }),
    }));
    const blockedSend = await fetch(`${baseUrl}/api/inside-sales/customers/12/whatsapp-messages`, authorizedOptions(2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Before re-consent" }),
    }));
    const startTimestamp = customer12StopTimestamp + 2;
    const reconsent = await postInbound({
        id: "wamid.start-customer-12",
        from: "14155550112",
        text: "START",
        timestamp: startTimestamp,
    });
    const allowedSend = await fetch(`${baseUrl}/api/inside-sales/customers/12/whatsapp-messages`, authorizedOptions(2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "After re-consent" }),
    }));
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(staleReconsent.status, 200);
    assert.equal(inboundEvents.find((event) => event.providerMessageId === "wamid.stale-start-customer-12").processingClassification, "STALE_OPT_IN");
    assert.equal(ordinaryOptIn.status, 409);
    assert.equal(blockedSend.status, 409);
    assert.equal(reconsent.status, 200);
    assert.equal(allowedSend.status, 202);
    assert.equal(dispatch.status, "SENT");
    assert.equal(providerCalls, providerCallsBefore + 1);
    assert.equal(consentEvents.filter((event) => event.customerId === 12).at(-1).status, "OPTED_IN");
    assert.equal(consentEvents.filter((event) => event.customerId === 12).at(-1).source, "WHATSAPP_KEYWORD_START");
    assert.equal(consentEvents.filter((event) => event.customerId === 12).at(-1).consentAt.getTime(), startTimestamp * 1000);
});

test("concurrent duplicate inbound webhooks create one event and one STOP transition", async () => {
    customers.find((customer) => customer.id === 16).lastWhatsappInboundAt = new Date(Date.now() - 60_000);
    const beforeInboundUpdates = inboundWindowUpdateCount;
    const stop = inboundPayload({
        id: "wamid.concurrent-stop-customer-16",
        from: "14155550116",
        text: "STOP",
        timestamp: Math.floor(Date.now() / 1000) - 2,
    });
    const [first, duplicate] = await Promise.all([postWebhook(stop), postWebhook(stop)]);
    const repeated = await postInbound({
        id: "wamid.concurrent-stop-customer-16-repeat",
        from: "14155550116",
        text: "STOPALL",
        timestamp: Math.floor(Date.now() / 1000) - 1,
    });

    assert.equal(first.status, 200);
    assert.equal(duplicate.status, 200);
    assert.equal(repeated.status, 200);
    assert.equal(inboundEvents.filter((event) => event.providerMessageId === "wamid.concurrent-stop-customer-16").length, 1);
    assert.equal(inboundWindowUpdateCount, beforeInboundUpdates + 2);
    assert.equal(consentEvents.filter((event) => event.customerId === 16 && event.status === "OPTED_OUT").length, 1);
});

test("send waits for an in-progress opt-out transaction and does not call Meta", async () => {
    await postInbound({
        id: "wamid.start-customer-15",
        from: "14155550115",
        text: "START",
        timestamp: Math.floor(Date.now() / 1000) - 20,
    });
    const pause = pauseNextCustomerLock(15);
    const stopResponse = postInbound({
        id: "wamid.race-stop-customer-15",
        from: "14155550115",
        text: "STOP",
        timestamp: Math.floor(Date.now() / 1000) - 10,
    });
    await pause.acquired;

    let markSendLockAttempted;
    const sendLockAttempted = new Promise((resolve) => { markSendLockAttempted = resolve; });
    onLockAttempt = (customerId) => {
        if (customerId === 15) {
            onLockAttempt = null;
            markSendLockAttempted();
        }
    };
    const providerCallsBefore = providerCalls;
    const sendResponse = fetch(`${baseUrl}/api/admin/customers/15/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Must not pass opt-out" }),
    }));
    await sendLockAttempted;
    pause.release();

    const [stopResult, sendResult] = await Promise.all([stopResponse, sendResponse]);
    assert.equal(stopResult.status, 200);
    assert.equal(sendResult.status, 409);
    assert.equal(providerCalls, providerCallsBefore);
});

test("denies other employees and OUTSIDE_SALES and does not accept a caller-supplied recipient", async () => {
    const wrongOwner = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(2, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    const outsideSales = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(5, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    const forgedRecipient = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(1, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello", to: "14155559999" }),
    }));

    assert.equal(wrongOwner.status, 404);
    assert.equal(outsideSales.status, 403);
    assert.equal(forgedRecipient.status, 400);
});

test("marks a provider send failure as FAILED without returning provider details", async () => {
    providerFailure = true;
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Hello" }),
    }));
    const dispatch = await outboxDispatcher.dispatchOnce();
    providerFailure = false;
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(dispatch.status, "FAILED");
    assert.equal(messages.at(-1).deliveryStatus, "FAILED");
    assert.equal(body.data.acceptedByProvider, false);
});

test("replays the original result for the same idempotency key and payload", async () => {
    const key = "retry-same-payload-001";
    const first = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Retry safely", key));
    const firstBody = await first.json();
    const duplicate = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Retry safely", key));
    const duplicateBody = await duplicate.json();
    const matchingRecords = idempotencyRecords.filter((record) => record.senderUserId === 3
        && record.customerId === 13
        && record.idempotencyKey === key);
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(first.status, 202);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.data.message.id, firstBody.data.message.id);
    assert.equal(duplicateBody.data.message.outbox.status, "PENDING");
    assert.equal(matchingRecords.length, 1);
    assert.equal(dispatch.status, "SENT");
});

test("rejects reuse of an idempotency key with different content", async () => {
    const key = "retry-different-payload-001";
    const first = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Original content", key));
    const firstBody = await first.json();
    const countBefore = messages.length;
    const conflict = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Changed content", key));
    const conflictBody = await conflict.json();
    await outboxDispatcher.dispatchOnce();

    assert.equal(first.status, 202);
    assert.equal(conflict.status, 409);
    assert.match(conflictBody.message, /different message/);
    assert.equal(messages.length, countBefore);
    assert.equal(outboxRecords.filter((record) => record.messageLogId === firstBody.data.message.id).length, 1);
});

test("concurrent duplicate requests create only one message and outbox record", async () => {
    const key = "retry-concurrent-001";
    const [first, second] = await Promise.all([
        fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "One queued message", key)),
        fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "One queued message", key)),
    ]);
    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.deepEqual([first.status, second.status].sort(), [200, 202]);
    assert.equal(firstBody.data.message.id, secondBody.data.message.id);
    assert.equal(idempotencyRecords.filter((record) => record.senderUserId === 3
        && record.customerId === 13
        && record.idempotencyKey === key).length, 1);
    assert.equal(dispatch.status, "SENT");
});

test("recovers a unique-constraint race by returning the committed original result", async () => {
    const key = "retry-unique-race-001";
    const original = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Committed first", key));
    const originalBody = await original.json();
    hideExistingIdempotencyOnce = true;
    snapshotNextTransaction = true;
    const raced = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Committed first", key));
    snapshotNextTransaction = false;
    const racedBody = await raced.json();
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(original.status, 202);
    assert.equal(raced.status, 200);
    assert.equal(racedBody.data.message.id, originalBody.data.message.id);
    assert.equal(dispatch.status, "SENT");
});

test("scopes identical idempotency keys to both sender and customer", async () => {
    const senderKey = "same-key-different-sender";
    const senderOne = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Sender one", senderKey));
    const senderTwo = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(4, "Sender two", senderKey));
    const customerKey = "same-key-different-customer";
    const customerOne = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Customer one", customerKey));
    const customerTwo = await fetch(`${baseUrl}/api/admin/customers/11/whatsapp-messages`, sendOptions(3, "Customer two", customerKey));
    const bodies = await Promise.all([senderOne.json(), senderTwo.json(), customerOne.json(), customerTwo.json()]);
    const results = [];
    for (let index = 0; index < 4; index += 1) {
        results.push(await outboxDispatcher.dispatchOnce());
    }

    assert.deepEqual([senderOne.status, senderTwo.status, customerOne.status, customerTwo.status], [202, 202, 202, 202]);
    assert.equal(new Set(bodies.map((body) => body.data.message.id)).size, 4);
    assert.equal(results.filter((result) => result.status === "SENT").length, 4);
});

test("creates the message log and outbox record atomically", async () => {
    const messageCount = messages.length;
    const outboxCount = outboxRecords.length;
    failOutboxCreate = true;
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Atomic enqueue" }),
    }));
    failOutboxCreate = false;

    assert.equal(response.status, 500);
    assert.equal(messages.length, messageCount);
    assert.equal(outboxRecords.length, outboxCount);
});

test("cancels a queued message when opt-out commits before the submission boundary", async () => {
    await postInbound({ id: "wamid.customer-17-start", from: "14155550117", text: "START" });
    const response = await fetch(`${baseUrl}/api/admin/customers/17/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Must be cancelled" }),
    }));
    const body = await response.json();
    const optOut = await fetch(`${baseUrl}/api/admin/customers/17/whatsapp-consent`, authorizedOptions(3, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consented: false, source: "CUSTOMER_REQUEST" }),
    }));
    const providerCallsBefore = providerCalls;
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(response.status, 202);
    assert.equal(body.data.queued, true);
    assert.equal(optOut.status, 201);
    assert.equal(dispatch.status, "CANCELLED");
    assert.equal(outboxRecords.find((record) => record.messageLogId === body.data.message.id).status, "CANCELLED");
    assert.equal(messages.find((message) => message.id === body.data.message.id).deliveryStatus, "FAILED");
    assert.equal(providerCalls, providerCallsBefore);
});

test("rechecks the 24-hour service window at submission time", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Window may expire while queued" }),
    }));
    const body = await response.json();
    const customer = customers.find((item) => item.id === 13);
    const previousInbound = customer.lastWhatsappInboundAt;
    customer.lastWhatsappInboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const providerCallsBefore = providerCalls;
    const dispatch = await outboxDispatcher.dispatchOnce();
    customer.lastWhatsappInboundAt = previousInbound;

    assert.equal(response.status, 202);
    assert.equal(dispatch.status, "CANCELLED");
    assert.equal(outboxRecords.find((record) => record.messageLogId === body.data.message.id).lastErrorCode, "SERVICE_WINDOW_CLOSED");
    assert.equal(providerCalls, providerCallsBefore);
});

test("atomically claims a queued message once across concurrent workers", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Only one worker may send" }),
    }));
    const body = await response.json();
    const providerCallsBefore = providerCalls;
    const results = await Promise.all([
        outboxDispatcher.dispatchOnce(),
        outboxDispatcher.dispatchOnce(),
    ]);

    assert.equal(response.status, 202);
    assert.equal(results.filter((result) => result.status === "SENT").length, 1);
    assert.equal(providerCalls, providerCallsBefore + 1);
    assert.equal(outboxRecords.find((record) => record.messageLogId === body.data.message.id).status, "SENT");
});

test("marks uncertain provider outcomes UNKNOWN and never retries them automatically", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Acceptance may be uncertain" }),
    }));
    const body = await response.json();
    const providerCallsBefore = providerCalls;
    providerOutcomeUnknown = true;
    const firstDispatch = await outboxDispatcher.dispatchOnce();
    providerOutcomeUnknown = false;
    const secondDispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(response.status, 202);
    assert.equal(firstDispatch.status, "UNKNOWN");
    assert.equal(outboxRecords.find((record) => record.messageLogId === body.data.message.id).status, "UNKNOWN");
    assert.equal(secondDispatch.processed, false);
    assert.equal(providerCalls, providerCallsBefore + 1);
});

test("requeues stale PROCESSING claims but marks stale SUBMITTING work UNKNOWN", async () => {
    const firstResponse = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Claimed but not submitted" }),
    }));
    const firstBody = await firstResponse.json();
    const secondResponse = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, authorizedOptions(3, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageContent: "Submission outcome unknown" }),
    }));
    const secondBody = await secondResponse.json();
    const firstOutbox = outboxRecords.find((record) => record.messageLogId === firstBody.data.message.id);
    const secondOutbox = outboxRecords.find((record) => record.messageLogId === secondBody.data.message.id);
    const staleDate = new Date(Date.now() - 120_000);
    Object.assign(firstOutbox, {
        status: "PROCESSING",
        claimToken: "crashed-before-submit",
        attemptCount: 1,
        processingStartedAt: staleDate,
    });
    Object.assign(secondOutbox, {
        status: "SUBMITTING",
        claimToken: "crashed-after-boundary",
        submissionStartedAt: staleDate,
    });

    const recovered = await outboxDispatcher.recoverStale();
    const providerCallsBefore = providerCalls;
    const notDueYet = await outboxDispatcher.dispatchOnce();
    const backoffUntil = firstOutbox.nextAttemptAt;
    firstOutbox.nextAttemptAt = new Date(Date.now() - 1);
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(firstResponse.status, 202);
    assert.equal(secondResponse.status, 202);
    assert.deepEqual(recovered, { requeued: 1, failed: 0, unknown: 1 });
    assert.equal(backoffUntil > new Date(), true);
    assert.equal(notDueYet.processed, false);
    assert.equal(firstOutbox.status, "SENT");
    assert.equal(secondOutbox.status, "UNKNOWN");
    assert.equal(dispatch.status, "SENT");
    assert.equal(providerCalls, providerCallsBefore + 1);
    const retry = await outboxDispatcher.dispatchOnce();
    assert.equal(retry.processed, false);
    assert.equal(providerCalls, providerCallsBefore + 1);
});

test("fails stale PROCESSING records after the bounded claim-attempt limit", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Exhaust claims"));
    const body = await response.json();
    const outbox = outboxRecords.find((record) => record.messageLogId === body.data.message.id);
    Object.assign(outbox, {
        status: "PROCESSING",
        claimToken: "crashed-at-limit",
        attemptCount: 5,
        processingStartedAt: new Date(Date.now() - 120_000),
    });
    const providerCallsBefore = providerCalls;
    const recovered = await outboxDispatcher.recoverStale();
    const dispatch = await outboxDispatcher.dispatchOnce();

    assert.equal(response.status, 202);
    assert.deepEqual(recovered, { requeued: 0, failed: 1, unknown: 0 });
    assert.equal(outbox.status, "FAILED");
    assert.equal(messages.find((message) => message.id === body.data.message.id).deliveryStatus, "FAILED");
    assert.equal(dispatch.processed, false);
    assert.equal(providerCalls, providerCallsBefore);
});

test("persists early duplicate statuses and reconciles them in provider-time order", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Early status test"));
    const body = await response.json();
    const timestamp = Math.floor(Date.now() / 1000) - 5;
    earlyStatusForNextSend = [
        { status: "delivered", timestamp: timestamp + 1 },
        { status: "delivered", timestamp: timestamp + 1 },
        { status: "sent", timestamp },
    ];
    const dispatch = await outboxDispatcher.dispatchOnce();
    const message = messages.find((candidate) => candidate.id === body.data.message.id);
    const reconciledEvents = statusEvents.filter((event) => event.messageLogId === message.id);

    assert.equal(response.status, 202);
    assert.equal(lastProviderMockError, null);
    assert.equal(dispatch.status, "SENT");
    assert.equal(message.deliveryStatus, "DELIVERED");
    assert.equal(reconciledEvents.length, 2);
    assert.equal(pendingStatusEvents.some((event) => event.providerMessageId === message.providerMessageId), false);
});

test("manually reconciles confirmed unmatched statuses transactionally and is safe to repeat", async () => {
    const messageLogId = 900_000 + crypto.randomInt(1_000_000);
    const providerMessageId = `wamid.manual.${crypto.randomUUID()}`;
    const outboxId = 900_000 + crypto.randomInt(1_000_000);
    const deliveredAt = new Date("2026-01-01T00:00:02.000Z");
    const readAt = new Date("2026-01-01T00:00:03.000Z");
    messages.push({
        id: messageLogId,
        providerMessageId: null,
        deliveryStatus: "PENDING",
        sentAt: null,
        statusUpdatedAt: null,
    });
    outboxRecords.push({
        id: outboxId,
        messageLogId,
        status: "UNKNOWN",
        claimToken: null,
        completedAt: new Date(),
        lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
    });
    pendingStatusEvents.push(
        { id: 90_000_001, providerMessageId, status: "READ", providerTimestamp: readAt, providerErrorCode: null },
        { id: 90_000_002, providerMessageId, status: "DELIVERED", providerTimestamp: deliveredAt, providerErrorCode: null },
    );

    const result = await reconcileUnmatchedWhatsAppStatusEvents(prismaClient, { messageLogId, providerMessageId });
    const message = messages.find((candidate) => candidate.id === messageLogId);
    const outbox = outboxRecords.find((candidate) => candidate.id === outboxId);
    assert.deepEqual(result, { alreadyReconciled: false, reconciledCount: 2 });
    assert.equal(message.providerMessageId, providerMessageId);
    assert.equal(message.deliveryStatus, "READ");
    assert.equal(message.statusUpdatedAt.getTime(), readAt.getTime());
    assert.equal(outbox.status, "SENT");
    assert.equal(outbox.claimToken, null);
    assert.equal(pendingStatusEvents.some((event) => event.providerMessageId === providerMessageId), false);
    assert.deepEqual(statusEvents
        .filter((event) => event.messageLogId === messageLogId)
        .map((event) => event.status), ["DELIVERED", "READ"]);

    const repeated = await reconcileUnmatchedWhatsAppStatusEvents(prismaClient, { messageLogId, providerMessageId });
    assert.deepEqual(repeated, { alreadyReconciled: true, reconciledCount: 0 });
    assert.equal(statusEvents.filter((event) => event.messageLogId === messageLogId).length, 2);
});

test("manual reconciliation rejects a provider ID already assigned to another message", async () => {
    const messageLogId = 1_900_000 + crypto.randomInt(1_000_000);
    const conflictingMessageId = messageLogId + 1;
    const providerMessageId = `wamid.conflict.${crypto.randomUUID()}`;
    messages.push(
        { id: messageLogId, providerMessageId: null, deliveryStatus: "PENDING", sentAt: null, statusUpdatedAt: null },
        { id: conflictingMessageId, providerMessageId, deliveryStatus: "SENT", sentAt: new Date(), statusUpdatedAt: null },
    );
    outboxRecords.push({
        id: 1_900_000 + crypto.randomInt(1_000_000),
        messageLogId,
        status: "FAILED",
        claimToken: null,
        completedAt: new Date(),
        lastErrorCode: "PROVIDER_REJECTED",
    });
    pendingStatusEvents.push({
        id: 91_000_001,
        providerMessageId,
        status: "DELIVERED",
        providerTimestamp: new Date("2026-01-01T00:00:02.000Z"),
        providerErrorCode: null,
    });

    await assert.rejects(
        reconcileUnmatchedWhatsAppStatusEvents(prismaClient, { messageLogId, providerMessageId }),
        /already assigned to another message log/,
    );
    assert.equal(messages.find((message) => message.id === messageLogId).providerMessageId, null);
    assert.equal(outboxRecords.find((record) => record.messageLogId === messageLogId).status, "FAILED");
    assert.equal(pendingStatusEvents.some((event) => event.providerMessageId === providerMessageId), true);
});

test("manual reconciliation leaves FAILED outboxes and pending events untouched", async () => {
    const messageLogId = 2_900_000 + crypto.randomInt(1_000_000);
    const providerMessageId = `wamid.failed.${crypto.randomUUID()}`;
    messages.push({
        id: messageLogId,
        providerMessageId: null,
        deliveryStatus: "PENDING",
        sentAt: null,
        statusUpdatedAt: null,
    });
    outboxRecords.push({
        id: 2_900_000 + crypto.randomInt(1_000_000),
        messageLogId,
        status: "FAILED",
        claimToken: null,
        completedAt: new Date(),
        lastErrorCode: "PROVIDER_REJECTED",
    });
    pendingStatusEvents.push({
        id: 92_000_001,
        providerMessageId,
        status: "DELIVERED",
        providerTimestamp: new Date("2026-01-01T00:00:02.000Z"),
        providerErrorCode: null,
    });

    await assert.rejects(
        reconcileUnmatchedWhatsAppStatusEvents(prismaClient, { messageLogId, providerMessageId }),
        /not eligible for manual reconciliation/,
    );
    assert.equal(messages.find((message) => message.id === messageLogId).providerMessageId, null);
    assert.equal(outboxRecords.find((record) => record.messageLogId === messageLogId).status, "FAILED");
    assert.equal(pendingStatusEvents.some((event) => event.providerMessageId === providerMessageId), true);
});

test("retries finalization without resending when status reconciliation transaction fails", async () => {
    const response = await fetch(`${baseUrl}/api/admin/customers/13/whatsapp-messages`, sendOptions(3, "Retry finalization"));
    const body = await response.json();
    earlyStatusForNextSend = [{ status: "read", timestamp: Math.floor(Date.now() / 1000) }];
    failStatusReconcile = true;
    const providerCallsBefore = providerCalls;
    const dispatch = await outboxDispatcher.dispatchOnce();
    const message = messages.find((candidate) => candidate.id === body.data.message.id);

    assert.equal(response.status, 202);
    assert.equal(lastProviderMockError, null);
    assert.equal(dispatch.status, "SENT");
    assert.equal(providerCalls, providerCallsBefore + 1);
    assert.match(message.providerMessageId, /^wamid\./);
    assert.equal(message.deliveryStatus, "READ");
    assert.equal(pendingStatusEvents.some((event) => event.providerMessageId === message.providerMessageId), false);
});

test("paginates message history and restricts it to the assigned customer", async () => {
    const historyCustomerId = 11;
    for (let index = 0; index < 3; index += 1) {
        messages.push({
            id: nextMessageId++,
            customerId: historyCustomerId,
            triggeredByUserId: 1,
            messageType: "GENERAL_UPDATE",
            messageContent: `History ${index}`,
            providerMessageId: `wamid.history.${index}`,
            deliveryStatus: "DELIVERED",
            sentAt: new Date(),
            statusUpdatedAt: new Date(),
            createdAt: new Date(Date.now() + index),
        });
    }
    const response = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages?page=2&pageSize=1`, authorizedOptions(1));
    const body = await response.json();
    const otherOwner = await fetch(`${baseUrl}/api/inside-sales/customers/11/whatsapp-messages`, authorizedOptions(2));

    assert.equal(response.status, 200);
    assert.equal(body.data.messages.length, 1);
    assert.deepEqual(body.data.pagination, { page: 2, pageSize: 1, total: messages.filter((item) => item.customerId === 11).length, totalPages: messages.filter((item) => item.customerId === 11).length });
    assert.equal(otherOwner.status, 404);
});

test("verifies webhook challenge and rejects invalid raw-body signatures", async () => {
    const validChallenge = await fetch(`${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge`);
    const invalidChallenge = await fetch(`${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge`);
    const invalidSignature = await postWebhook({ object: "whatsapp_business_account", entry: [] }, false);
    const rawBody = Buffer.from('{"exact":"body"}');

    assert.equal(validChallenge.status, 200);
    assert.equal(await validChallenge.text(), "challenge");
    assert.equal(invalidChallenge.status, 403);
    assert.equal(invalidSignature.status, 401);
    assert.equal(verifyMetaWebhookSignature(rawBody, signatureFor(rawBody), appSecret), true);
    assert.equal(verifyMetaWebhookSignature(rawBody, "sha256=invalid", appSecret), false);
});

test("rejects malformed signed webhook JSON and malformed event collections", async () => {
    const invalidJson = await postRawWebhook("{");
    const malformedChanges = await postWebhook({
        object: "whatsapp_business_account",
        entry: [{ changes: {} }],
    });

    assert.equal(invalidJson.status, 400);
    assert.equal(malformedChanges.status, 400);
});

test("deduplicates delivery events and ignores out-of-order status updates", async () => {
    const previousStatusEventCount = statusEvents.length;
    const message = {
        id: nextMessageId++,
        customerId: 11,
        triggeredByUserId: 1,
        messageType: "GENERAL_UPDATE",
        messageContent: "Status test",
        providerMessageId: "wamid.status-test",
        deliveryStatus: "SENT",
        sentAt: new Date(),
        statusUpdatedAt: null,
        createdAt: new Date(),
    };
    messages.push(message);
    const now = Math.floor(Date.now() / 1000);
    const deliveryPayload = {
        object: "whatsapp_business_account",
        entry: [{
            changes: [{
                value: {
                    metadata: { phone_number_id: environment.META_WHATSAPP_PHONE_NUMBER_ID },
                    statuses: [{ id: message.providerMessageId, status: "delivered", timestamp: String(now - 10) }],
                },
            }],
        }],
    };
    assert.equal((await postWebhook(deliveryPayload)).status, 200);
    assert.equal((await postWebhook(deliveryPayload)).status, 200);

    const newerSentPayload = structuredClone(deliveryPayload);
    newerSentPayload.entry[0].changes[0].value.statuses = [
        { id: message.providerMessageId, status: "sent", timestamp: String(now - 5) },
    ];
    assert.equal((await postWebhook(newerSentPayload)).status, 200);

    const readPayload = structuredClone(deliveryPayload);
    readPayload.entry[0].changes[0].value.statuses = [
        { id: message.providerMessageId, status: "read", timestamp: String(now - 7) },
    ];
    assert.equal((await postWebhook(readPayload)).status, 200);

    const oldSentPayload = structuredClone(deliveryPayload);
    oldSentPayload.entry[0].changes[0].value.statuses = [
        { id: message.providerMessageId, status: "sent", timestamp: String(now - 20) },
    ];
    assert.equal((await postWebhook(oldSentPayload)).status, 200);

    assert.equal(message.deliveryStatus, "READ");
    assert.equal(message.statusUpdatedAt.getTime(), (now - 7) * 1000);
    assert.equal(statusEvents.length, previousStatusEventCount + 4);
});

test("records inbound customer activity for the 24-hour service window", async () => {
    const response = await postInbound({
        id: "wamid.window-refresh-customer-11",
        from: "14155550111",
        text: "Interested in the property",
        timestamp: Math.floor(Date.now() / 1000),
    });
    assert.equal(response.status, 200);
    assert.ok(customers[0].lastWhatsappInboundAt instanceof Date);
    assert.equal(Date.now() - customers[0].lastWhatsappInboundAt.getTime() < 5_000, true);
    assert.equal(inboundEvents.at(-1).messageType, "text");
    assert.equal(inboundEvents.at(-1).processingClassification, "NORMAL");
    assert.equal(Object.prototype.hasOwnProperty.call(inboundEvents.at(-1), "text"), false);
});
