import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createIntegrationPrisma, requireTestDatabaseUrl } from "./support/testDatabase.js";

const enabled = process.env.TEST_DATABASE_URL !== undefined || process.env.INTEGRATION_TESTS_ENABLED === "true";

if (!enabled) {
    test("WhatsApp PostgreSQL integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
    const testDatabaseUrl = requireTestDatabaseUrl();
    const primaryUrl = new URL(testDatabaseUrl);
    primaryUrl.searchParams.set("application_name", "whatsapp-integration-primary");
    const secondaryUrl = new URL(testDatabaseUrl);
    secondaryUrl.searchParams.set("application_name", "whatsapp-integration-secondary");
    const prisma = createIntegrationPrisma(primaryUrl.toString());
    const secondPrisma = createIntegrationPrisma(secondaryUrl.toString());
    process.env.DATABASE_URL = testDatabaseUrl;

    const [{ createApp }, { createWhatsAppOutboxDispatcher }, { reconcileUnmatchedWhatsAppStatusEvents }] = await Promise.all([
        import("../src/app.js"),
        import("../src/dispatchers/whatsAppOutboxDispatcher.js"),
        import("../src/controllers/whatsAppController.js"),
    ]);
    const jwtConfig = {
        secret: crypto.randomBytes(32).toString("base64url"),
        expiresIn: "1h",
        issuer: "integration-whatsapp-api",
        audience: "integration-whatsapp-client",
    };
    const appSecret = crypto.randomBytes(32).toString("hex");
    const environment = {
        META_WHATSAPP_ACCESS_TOKEN: "integration-test-token",
        META_WHATSAPP_PHONE_NUMBER_ID: "123456789",
        META_WHATSAPP_VERIFY_TOKEN: "integration-test-verify-token",
        META_WHATSAPP_APP_SECRET: appSecret,
        META_GRAPH_API_VERSION: "v99.0",
    };
    const tracked = { users: [], customers: [], providerMessageIds: [] };
    const roles = {};
    let server;
    let secondServer;
    let baseUrl;
    let secondBaseUrl;

    async function start(app) {
        const listening = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });
        return { server: listening, baseUrl: `http://127.0.0.1:${listening.address().port}` };
    }

    function tokenFor(user) {
        return jwt.sign({ sub: String(user.id) }, jwtConfig.secret, {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: jwtConfig.issuer,
            audience: jwtConfig.audience,
        });
    }

    async function sendMessage(url, user, customer, messageContent, idempotencyKey) {
        return fetch(`${url}/api/admin/customers/${customer.id}/whatsapp-messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${tokenFor(user)}`,
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify({ messageContent }),
        });
    }

    async function fixture({ senders = 1, customers = 1 } = {}) {
        const nonce = crypto.randomUUID();
        const users = [];
        const customerRows = [];
        for (let index = 0; index < senders; index += 1) {
            const user = await prisma.user.create({
                data: {
                    roleId: roles.ADMIN.id,
                    fullName: `WhatsApp Integration Admin ${nonce}-${index}`,
                    email: `whatsapp-admin-${nonce}-${index}@integration.test`,
                    passwordHash: "integration-test-hash",
                },
            });
            users.push(user);
            tracked.users.push(user.id);
        }
        for (let index = 0; index < customers; index += 1) {
            const customer = await prisma.customer.create({
                data: {
                    fullName: `WhatsApp Integration Customer ${nonce}-${index}`,
                    phone: `+1415${crypto.randomInt(1_000_000, 10_000_000)}`,
                    lastWhatsappInboundAt: new Date(),
                },
            });
            customerRows.push(customer);
            tracked.customers.push(customer.id);
            await prisma.whatsAppConsentEvent.create({
                data: { customerId: customer.id, status: "OPTED_IN", source: "INTEGRATION_TEST" },
            });
        }
        return { users, customers: customerRows };
    }

    function statusPayload(providerMessageId, status, timestamp) {
        return {
            object: "whatsapp_business_account",
            entry: [{
                changes: [{
                    value: {
                        metadata: { phone_number_id: environment.META_WHATSAPP_PHONE_NUMBER_ID },
                        statuses: [{ id: providerMessageId, status, timestamp: String(timestamp) }],
                    },
                }],
            }],
        };
    }

    async function postStatus(url, providerMessageId, status, timestamp) {
        const body = JSON.stringify(statusPayload(providerMessageId, status, timestamp));
        const signature = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
        return fetch(`${url}/api/webhooks/whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
            body,
        });
    }

    async function createMessageAndOutbox(customer, user, status = "PENDING", extra = {}) {
        const message = await prisma.whatsAppMessageLog.create({
            data: {
                customerId: customer.id,
                triggeredByUserId: user.id,
                messageType: "GENERAL_UPDATE",
                messageContent: "PostgreSQL integration message",
                deliveryStatus: "PENDING",
            },
        });
        const outbox = await prisma.whatsAppMessageOutbox.create({
            data: { messageLogId: message.id, status, ...extra },
        });
        return { message, outbox };
    }

    function failPendingEventDeleteOnce(client, afterRollback) {
        let failures = 0;
        const wrappedClient = new Proxy(client, {
            get(target, property) {
                if (property !== "$transaction") return Reflect.get(target, property, target);
                return async (operation, ...options) => {
                    try {
                        return await target.$transaction(async (transaction) => operation(new Proxy(transaction, {
                            get(tx, txProperty) {
                                if (txProperty !== "whatsAppPendingStatusEvent") {
                                    return Reflect.get(tx, txProperty, tx);
                                }
                                return new Proxy(tx.whatsAppPendingStatusEvent, {
                                    get(model, method) {
                                        if (method === "deleteMany" && failures === 0) {
                                            return async () => {
                                                failures += 1;
                                                throw new Error("Injected PostgreSQL reconciliation failure.");
                                            };
                                        }
                                        return Reflect.get(model, method, model);
                                    },
                                });
                            },
                        })), ...options);
                    } catch (error) {
                        if (failures === 1) await afterRollback();
                        throw error;
                    }
                };
            },
        });
        return { client: wrappedClient, get failures() { return failures; } };
    }

    async function cleanupTrackedRecords() {
        if (tracked.customers.length) {
            const rows = await prisma.whatsAppMessageLog.findMany({
                where: { customerId: { in: tracked.customers } },
                select: { id: true, providerMessageId: true },
            });
            const messageIds = rows.map((row) => row.id);
            const providerIds = [
                ...tracked.providerMessageIds,
                ...rows.map((row) => row.providerMessageId).filter(Boolean),
            ];
            if (messageIds.length) {
                await prisma.whatsAppMessageStatusEvent.deleteMany({ where: { messageLogId: { in: messageIds } } });
                await prisma.whatsAppMessageIdempotency.deleteMany({ where: { messageLogId: { in: messageIds } } });
                await prisma.whatsAppMessageOutbox.deleteMany({ where: { messageLogId: { in: messageIds } } });
                await prisma.whatsAppMessageLog.deleteMany({ where: { id: { in: messageIds } } });
            }
            if (providerIds.length) {
                await prisma.whatsAppPendingStatusEvent.deleteMany({ where: { providerMessageId: { in: providerIds } } });
            }
            await prisma.whatsAppConsentEvent.deleteMany({ where: { customerId: { in: tracked.customers } } });
            await prisma.customer.deleteMany({ where: { id: { in: tracked.customers } } });
        }
        if (tracked.users.length) await prisma.user.deleteMany({ where: { id: { in: tracked.users } } });
        tracked.users.splice(0);
        tracked.customers.splice(0);
        tracked.providerMessageIds.splice(0);
    }

    before(async () => {
        roles.ADMIN = await prisma.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
        ({ server, baseUrl } = await start(createApp({
            prismaClient: prisma,
            jwtConfig,
            corsOptions: { origin: false },
            environment,
            metaWhatsAppClient: { async sendTextMessage() { throw new Error("Unexpected direct Meta call."); } },
        })));
        ({ server: secondServer, baseUrl: secondBaseUrl } = await start(createApp({
            prismaClient: secondPrisma,
            jwtConfig,
            corsOptions: { origin: false },
            environment,
            metaWhatsAppClient: { async sendTextMessage() { throw new Error("Unexpected direct Meta call."); } },
        })));
    });

    afterEach(cleanupTrackedRecords);

    after(async () => {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        await new Promise((resolve, reject) => secondServer.close((error) => (error ? reject(error) : resolve())));
        await Promise.all([prisma.$disconnect(), secondPrisma.$disconnect()]);
    });

    test("enforces idempotency and sender/customer isolation across independent PostgreSQL clients", async () => {
        const data = await fixture({ senders: 2, customers: 2 });
        const key = `integration-${crypto.randomUUID()}`;
        const responses = await Promise.all([
            sendMessage(baseUrl, data.users[0], data.customers[0], "Same content", key),
            sendMessage(secondBaseUrl, data.users[0], data.customers[0], "Same content", key),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 202]);

        const conflict = await sendMessage(secondBaseUrl, data.users[0], data.customers[0], "Changed content", key);
        assert.equal(conflict.status, 409);

        const differentSender = await sendMessage(secondBaseUrl, data.users[1], data.customers[0], "Same content", key);
        const differentCustomer = await sendMessage(baseUrl, data.users[0], data.customers[1], "Same content", key);
        assert.equal(differentSender.status, 202);
        assert.equal(differentCustomer.status, 202);

        const messages = await prisma.whatsAppMessageLog.findMany({
            where: { customerId: { in: data.customers.map((customer) => customer.id) } },
            select: { id: true, customerId: true, triggeredByUserId: true },
        });
        assert.equal(messages.length, 3);
        assert.equal(await prisma.whatsAppMessageIdempotency.count({ where: { idempotencyKey: key } }), 3);
        assert.equal(await prisma.whatsAppMessageOutbox.count({
            where: { messageLogId: { in: messages.map((message) => message.id) } },
        }), 3);
    });

    test("only one dispatcher claims an outbox record across independent PostgreSQL clients", async () => {
        const data = await fixture();
        const { message, outbox } = await createMessageAndOutbox(data.customers[0], data.users[0]);
        let providerCalls = 0;
        const providerMessageId = `wamid.integration.${crypto.randomUUID()}`;
        tracked.providerMessageIds.push(providerMessageId);
        const provider = {
            async sendTextMessage() {
                providerCalls += 1;
                await new Promise((resolve) => setTimeout(resolve, 20));
                return { providerMessageId };
            },
        };
        const firstDispatcher = createWhatsAppOutboxDispatcher({ prismaClient: prisma, metaWhatsAppClient: provider });
        const secondDispatcher = createWhatsAppOutboxDispatcher({ prismaClient: secondPrisma, metaWhatsAppClient: provider });
        const results = await Promise.all([firstDispatcher.dispatchOnce(), secondDispatcher.dispatchOnce()]);

        assert.equal(providerCalls, 1);
        assert.equal(results.filter((result) => result.status === "SENT").length, 1);
        const savedOutbox = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: outbox.id } });
        const savedMessage = await prisma.whatsAppMessageLog.findUnique({ where: { id: message.id } });
        assert.equal(savedOutbox.status, "SENT");
        assert.equal(savedOutbox.attemptCount, 1);
        assert.equal(savedMessage.providerMessageId, providerMessageId);
    });

    test("persists duplicate early webhooks and reconciles them in provider-time order", async () => {
        const data = await fixture();
        const { message, outbox } = await createMessageAndOutbox(data.customers[0], data.users[0]);
        const providerMessageId = `wamid.early.${crypto.randomUUID()}`;
        tracked.providerMessageIds.push(providerMessageId);
        const baseTimestamp = Math.floor(Date.now() / 1000) - 5;

        assert.equal((await postStatus(baseUrl, providerMessageId, "delivered", baseTimestamp + 1)).status, 200);
        assert.equal((await postStatus(baseUrl, providerMessageId, "delivered", baseTimestamp + 1)).status, 200);
        assert.equal((await postStatus(baseUrl, providerMessageId, "read", baseTimestamp + 2)).status, 200);
        assert.equal(await prisma.whatsAppPendingStatusEvent.count({ where: { providerMessageId } }), 2);

        let providerCalls = 0;
        let rollbackObserved = false;
        const flakyPrisma = failPendingEventDeleteOnce(prisma, async () => {
            const [messageState, outboxState, pendingCount, linkedCount] = await Promise.all([
                secondPrisma.whatsAppMessageLog.findUnique({
                    where: { id: message.id },
                    select: { providerMessageId: true },
                }),
                secondPrisma.whatsAppMessageOutbox.findUnique({
                    where: { id: outbox.id },
                    select: { status: true },
                }),
                secondPrisma.whatsAppPendingStatusEvent.count({ where: { providerMessageId } }),
                secondPrisma.whatsAppMessageStatusEvent.count({ where: { messageLogId: message.id } }),
            ]);
            rollbackObserved = messageState.providerMessageId === null
                && outboxState.status === "SUBMITTING"
                && pendingCount === 3
                && linkedCount === 0;
        });
        const dispatcher = createWhatsAppOutboxDispatcher({
            prismaClient: flakyPrisma.client,
            metaWhatsAppClient: {
                async sendTextMessage() {
                    providerCalls += 1;
                    const beforeFinalization = await secondPrisma.whatsAppMessageLog.findUnique({
                        where: { id: message.id },
                        select: { providerMessageId: true },
                    });
                    assert.equal(beforeFinalization.providerMessageId, null);
                    assert.equal((await postStatus(baseUrl, providerMessageId, "sent", baseTimestamp)).status, 200);
                    return { providerMessageId };
                },
            },
        });
        const result = await dispatcher.dispatchOnce();
        assert.equal(result.status, "SENT");
        assert.equal(providerCalls, 1);
        assert.equal(flakyPrisma.failures, 1);
        assert.equal(rollbackObserved, true);

        const savedMessage = await prisma.whatsAppMessageLog.findUnique({ where: { id: message.id } });
        assert.equal(savedMessage.deliveryStatus, "READ");
        assert.equal(savedMessage.statusUpdatedAt.getTime(), (baseTimestamp + 2) * 1000);
        assert.equal(await prisma.whatsAppPendingStatusEvent.count({ where: { providerMessageId } }), 0);
        assert.equal(await prisma.whatsAppMessageStatusEvent.count({ where: { messageLogId: message.id } }), 3);
        assert.equal((await prisma.whatsAppMessageOutbox.findUnique({ where: { id: outbox.id } })).status, "SENT");

        assert.equal((await postStatus(baseUrl, providerMessageId, "sent", baseTimestamp - 1)).status, 200);
        const afterOlderEvent = await prisma.whatsAppMessageLog.findUnique({ where: { id: message.id } });
        assert.equal(afterOlderEvent.deliveryStatus, "READ");
        assert.equal(afterOlderEvent.statusUpdatedAt.getTime(), (baseTimestamp + 2) * 1000);
    });

    test("manual unmatched reconciliation is atomic and repeatable on PostgreSQL", async () => {
        const data = await fixture();
        const { message, outbox } = await createMessageAndOutbox(data.customers[0], data.users[0], "UNKNOWN", {
            completedAt: new Date(),
            lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
        });
        const providerMessageId = `wamid.manual.${crypto.randomUUID()}`;
        tracked.providerMessageIds.push(providerMessageId);
        await prisma.whatsAppPendingStatusEvent.create({
            data: {
                providerMessageId,
                status: "DELIVERED",
                providerTimestamp: new Date(Date.now() - 2_000),
            },
        });

        const result = await reconcileUnmatchedWhatsAppStatusEvents(prisma, {
            messageLogId: message.id,
            providerMessageId,
        });
        assert.deepEqual(result, { alreadyReconciled: false, reconciledCount: 1 });
        const linkedMessage = await prisma.whatsAppMessageLog.findUnique({ where: { id: message.id } });
        const linkedOutbox = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: outbox.id } });
        assert.equal(linkedMessage.providerMessageId, providerMessageId);
        assert.equal(linkedMessage.deliveryStatus, "DELIVERED");
        assert.equal(linkedOutbox.status, "SENT");
        assert.equal(await prisma.whatsAppPendingStatusEvent.count({ where: { providerMessageId } }), 0);

        const repeated = await reconcileUnmatchedWhatsAppStatusEvents(prisma, {
            messageLogId: message.id,
            providerMessageId,
        });
        assert.deepEqual(repeated, { alreadyReconciled: true, reconciledCount: 0 });
    });

    test("recovers stale PROCESSING with bounded backoff and never resends UNKNOWN or stale SUBMITTING", async () => {
        const data = await fixture();
        const before = Date.now();
        const stale = new Date(before - 120_000);
        const pending = await createMessageAndOutbox(data.customers[0], data.users[0], "PROCESSING", {
            attemptCount: 2,
            claimToken: crypto.randomUUID(),
            processingStartedAt: stale,
        });
        const exhausted = await createMessageAndOutbox(data.customers[0], data.users[0], "PROCESSING", {
            attemptCount: 5,
            claimToken: crypto.randomUUID(),
            processingStartedAt: stale,
        });
        const submitting = await createMessageAndOutbox(data.customers[0], data.users[0], "SUBMITTING", {
            attemptCount: 1,
            claimToken: crypto.randomUUID(),
            submissionStartedAt: stale,
        });
        const unknown = await createMessageAndOutbox(data.customers[0], data.users[0], "UNKNOWN", {
            attemptCount: 1,
            lastErrorCode: "PROVIDER_OUTCOME_UNKNOWN",
        });
        let providerCalls = 0;
        const dispatcher = createWhatsAppOutboxDispatcher({
            prismaClient: prisma,
            metaWhatsAppClient: { async sendTextMessage() { providerCalls += 1; return { providerMessageId: "unused" }; } },
        });

        await dispatcher.dispatchOnce();
        const after = Date.now();
        const requeued = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: pending.outbox.id } });
        const failed = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: exhausted.outbox.id } });
        const unknownSubmission = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: submitting.outbox.id } });
        const unchangedUnknown = await prisma.whatsAppMessageOutbox.findUnique({ where: { id: unknown.outbox.id } });
        assert.equal(requeued.status, "PENDING");
        assert.ok(requeued.nextAttemptAt.getTime() >= before + 1_900);
        assert.ok(requeued.nextAttemptAt.getTime() <= after + 2_500);
        assert.equal(failed.status, "FAILED");
        assert.equal(unknownSubmission.status, "UNKNOWN");
        assert.equal(unchangedUnknown.status, "UNKNOWN");
        assert.equal(providerCalls, 0);
    });
}
