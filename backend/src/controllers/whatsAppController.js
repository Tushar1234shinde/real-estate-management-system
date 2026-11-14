import crypto from "node:crypto";
import prisma from "../config/prisma.js";
import { getMetaWhatsAppSendConfig, getMetaWhatsAppWebhookConfig } from "../config/metaWhatsApp.js";
import { AppError } from "../errors/AppError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_MESSAGE_LENGTH = 4_096;
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_TIMESTAMP_MS = 5 * 60 * 1000;
const STATUS_RANK = Object.freeze({ PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 });
const OPT_OUT_KEYWORDS = new Set([
    "STOP",
    "STOPALL",
    "UNSUBSCRIBE",
    "CANCEL",
    "END",
    "QUIT",
    "STOP MESSAGES",
    "STOP MESSAGING",
    "STOP ALL",
]);
const OPT_IN_KEYWORDS = new Set(["START", "UNSTOP"]);
const META_STATUS = Object.freeze({
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
});
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/;

const messageWriteSelect = {
    id: true,
    customerId: true,
    triggeredByUserId: true,
    messageType: true,
    messageContent: true,
    providerMessageId: true,
    deliveryStatus: true,
    sentAt: true,
    statusUpdatedAt: true,
    createdAt: true,
};

const messageSelect = {
    ...messageWriteSelect,
    outbox: {
        select: {
            status: true,
            attemptCount: true,
        },
    },
};

function parsePositiveInteger(value, fieldName) {
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw new AppError(400, `${fieldName} must be a positive integer.`);
    }
    return parsed;
}

function parsePage(value, fallback, fieldName, maximum) {
    if (value === undefined) return fallback;
    const parsed = parsePositiveInteger(value, fieldName);
    if (maximum && parsed > maximum) {
        throw new AppError(400, `${fieldName} must be between 1 and ${maximum}.`);
    }
    return parsed;
}

function parseObjectBody(body, allowedFields) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new AppError(400, "Request body must be a JSON object.");
    }
    if (Object.keys(body).some((field) => !allowedFields.has(field))) {
        throw new AppError(400, "Request body contains unsupported fields.");
    }
}

function parseMessageBody(body) {
    parseObjectBody(body, new Set(["messageContent", "outcome"]));
    if (body.outcome !== undefined) {
        if (body.messageContent !== undefined || !["INTERESTED", "NOT_INTERESTED"].includes(body.outcome)) {
            throw new AppError(400, "outcome must be INTERESTED or NOT_INTERESTED and cannot be combined with messageContent.");
        }
        return body.outcome === "INTERESTED"
            ? { messageType: "INTERESTED_THANK_YOU", messageContent: "Thank you for your interest in PropLattice. We are pleased to help with the next steps for your selected property. Reply here if you have any questions." }
            : { messageType: "NOT_INTERESTED_FOLLOW_UP", messageContent: "Thank you for letting us know. We will respect your preference and will not send further property updates unless you choose to contact us again." };
    }
    if (typeof body.messageContent !== "string") {
        throw new AppError(400, "messageContent must be a non-empty string.");
    }
    const messageContent = body.messageContent.trim();
    if (!messageContent || messageContent.length > MAX_MESSAGE_LENGTH) {
        throw new AppError(400, `messageContent must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`);
    }
    return { messageType: "GENERAL_UPDATE", messageContent };
}

function parseIdempotencyKey(value) {
    if (value === undefined) return null;
    if (typeof value !== "string" || !/^[A-Za-z0-9._~-]{1,128}$/.test(value)) {
        throw new AppError(400, "Idempotency-Key must be 1 to 128 URL-safe characters.");
    }
    return value;
}

function messagePayloadFingerprint(messageContent, messageType) {
    return crypto.createHash("sha256")
        .update(JSON.stringify({ version: 1, messageType, messageContent }))
        .digest("hex");
}

function idempotencyWhere(senderUserId, customerId, idempotencyKey) {
    return {
        senderUserId_customerId_idempotencyKey: {
            senderUserId,
            customerId,
            idempotencyKey,
        },
    };
}

async function findIdempotentMessage(prismaClient, senderUserId, customerId, idempotencyKey) {
    if (!idempotencyKey) return null;
    return prismaClient.whatsAppMessageIdempotency.findUnique({
        where: idempotencyWhere(senderUserId, customerId, idempotencyKey),
        select: {
            payloadFingerprint: true,
            messageLog: { select: messageSelect },
        },
    });
}

function idempotentResponse(message) {
    const status = message.outbox?.status;
    return {
        message,
        queued: status === "PENDING" || status === "PROCESSING" || status === "SUBMITTING",
        acceptedByProvider: status === "SENT",
    };
}

function parseConsentBody(body) {
    parseObjectBody(body, new Set(["consented", "source"]));
    if (typeof body.consented !== "boolean") {
        throw new AppError(400, "consented must be a boolean.");
    }
    if (body.consented) {
        throw new AppError(409, "Opt-in must come directly from the customer by sending START or UNSTOP on WhatsApp.");
    }
    if (body.source !== "CUSTOMER_REQUEST") {
        throw new AppError(400, "source must be CUSTOMER_REQUEST when recording an opt-out.");
    }
    return {
        status: "OPTED_OUT",
        source: "STAFF_RECORDED_CUSTOMER_REQUEST",
    };
}

function customerWhere(req, customerId) {
    return req.user.role === "INSIDE_SALES"
        ? { id: customerId, assignment: { is: { insideSalesEmployeeId: req.user.id } } }
        : { id: customerId };
}

async function findAccessibleCustomer(prismaClient, req, customerId) {
    const customer = await prismaClient.customer.findFirst({
        where: customerWhere(req, customerId),
        select: { id: true, phone: true, lastWhatsappInboundAt: true },
    });
    if (!customer) throw new AppError(404, "Customer not found.");
    return customer;
}

export async function latestConsent(prismaClient, customerId) {
    return prismaClient.whatsAppConsentEvent.findFirst({
        where: { customerId },
        orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
        select: {
            id: true,
            status: true,
            source: true,
            recordedAt: true,
            consentAt: true,
            inboundMessageEvent: {
                select: { providerTimestamp: true },
            },
        },
    });
}

export function customerPhoneForWhatsApp(phone) {
    if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) {
        throw new AppError(422, "Customer phone number is not in a supported international format.");
    }
    return phone.startsWith("+") ? phone.slice(1) : phone;
}

export function isWithinCustomerServiceWindow(lastInboundAt, now = Date.now()) {
    if (!(lastInboundAt instanceof Date) || Number.isNaN(lastInboundAt.getTime())) return false;
    const age = now - lastInboundAt.getTime();
    return age >= 0 && age < CUSTOMER_SERVICE_WINDOW_MS;
}

function isUniqueConstraintError(error) {
    return error?.code === "P2002";
}

export async function lockCustomerForWhatsApp(transaction, customerId) {
    await transaction.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId} FOR UPDATE`;
}

function parseProviderTimestamp(value) {
    if (typeof value !== "string" || !/^\d{1,12}$/.test(value)) return null;
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds)) return null;
    const timestamp = new Date(seconds * 1000);
    if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() > Date.now() + MAX_FUTURE_TIMESTAMP_MS) return null;
    return timestamp;
}

function timingSafeStringEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyMetaWebhookSignature(rawBody, signature, appSecret) {
    if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^sha256=[a-f\d]{64}$/i.test(signature)) {
        return false;
    }
    const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    return timingSafeStringEqual(signature.toLowerCase(), expected);
}

function normalizeKeywordText(value) {
    if (typeof value !== "string" || value.length > 128) return null;
    return value
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .toUpperCase()
        .replace(/[.!?]+$/u, "")
        .trim()
        .replace(/\s+/g, " ");
}

function classifyInboundMessage(message) {
    const messageType = typeof message.type === "string" && message.type.length <= 64
        ? message.type
        : "unknown";
    if (messageType !== "text") {
        return { messageType, classification: "UNSUPPORTED", keyword: null };
    }
    const keyword = normalizeKeywordText(message.text?.body);
    if (keyword && OPT_OUT_KEYWORDS.has(keyword)) {
        return { messageType, classification: "OPT_OUT", keyword };
    }
    if (keyword && OPT_IN_KEYWORDS.has(keyword)) {
        return { messageType, classification: "OPT_IN", keyword };
    }
    return { messageType, classification: "NORMAL", keyword: null };
}

async function findCustomerIdsByPhone(transaction, from) {
    return transaction.customer.findMany({
        where: { OR: [{ phone: from }, { phone: `+${from}` }] },
        select: { id: true },
        take: 2,
    });
}

function isValidInboundMessage(message) {
    return message
        && typeof message === "object"
        && !Array.isArray(message)
        && typeof message.id === "string"
        && message.id.startsWith("wamid.")
        && message.id.length <= 255
        && typeof message.from === "string"
        && /^\d{8,15}$/.test(message.from)
        && parseProviderTimestamp(message.timestamp);
}

async function processInboundMessage(prismaClient, inbound) {
    if (!isValidInboundMessage(inbound)) return;
    const providerTimestamp = parseProviderTimestamp(inbound.timestamp);

    try {
        await prismaClient.$transaction(async (transaction) => {
            if (await transaction.whatsAppInboundMessageEvent.findUnique({
                where: { providerMessageId: inbound.id },
                select: { id: true },
            })) {
                return;
            }

            const candidateCustomers = await findCustomerIdsByPhone(transaction, inbound.from);
            let customerId = candidateCustomers.length === 1 ? candidateCustomers[0].id : null;
            if (customerId !== null) {
                await lockCustomerForWhatsApp(transaction, customerId);
                const currentMatches = await findCustomerIdsByPhone(transaction, inbound.from);
                if (currentMatches.length !== 1 || currentMatches[0].id !== customerId) {
                    customerId = null;
                }
            }

            if (await transaction.whatsAppInboundMessageEvent.findUnique({
                where: { providerMessageId: inbound.id },
                select: { id: true },
            })) {
                return;
            }

            const { messageType, classification: detectedClassification, keyword } = classifyInboundMessage(inbound);
            const consent = customerId === null ? null : await latestConsent(transaction, customerId);
            let classification = customerId === null ? "UNMATCHED" : detectedClassification;
            if (classification === "OPT_IN"
                && consent?.status === "OPTED_OUT"
                && consent.consentAt
                && providerTimestamp <= consent.consentAt) {
                classification = "STALE_OPT_IN";
            }

            const event = await transaction.whatsAppInboundMessageEvent.create({
                data: {
                    providerMessageId: inbound.id,
                    customerId,
                    senderPhone: inbound.from,
                    providerTimestamp,
                    messageType,
                    processingClassification: classification,
                },
                select: { id: true },
            });

            if (customerId === null) return;

            await transaction.customer.updateMany({
                where: {
                    id: customerId,
                    OR: [
                        { lastWhatsappInboundAt: null },
                        { lastWhatsappInboundAt: { lt: providerTimestamp } },
                    ],
                },
                data: { lastWhatsappInboundAt: providerTimestamp },
            });

            if (classification === "OPT_OUT" && consent?.status !== "OPTED_OUT") {
                await transaction.whatsAppConsentEvent.create({
                    data: {
                        customerId,
                        recordedByUserId: null,
                        inboundMessageEventId: event.id,
                        status: "OPTED_OUT",
                        source: `WHATSAPP_KEYWORD_${keyword.replace(/\s+/g, "_")}`,
                        consentAt: providerTimestamp,
                    },
                });
            } else if (classification === "OPT_IN" && consent?.status !== "OPTED_IN") {
                await transaction.whatsAppConsentEvent.create({
                    data: {
                        customerId,
                        recordedByUserId: null,
                        inboundMessageEventId: event.id,
                        status: "OPTED_IN",
                        source: `WHATSAPP_KEYWORD_${keyword}`,
                        consentAt: providerTimestamp,
                    },
                });
            }
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
    }
}

function statusEventErrorCode(statusEvent, status) {
    return status === "FAILED" && Array.isArray(statusEvent.errors)
        ? String(statusEvent.errors[0]?.code ?? "").slice(0, 100) || null
        : null;
}

export async function lockWhatsAppProviderMessage(transaction, providerMessageId) {
    const lockKey = `whatsapp-provider-status:${providerMessageId}`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0)) IS NOT NULL AS locked`;
}

async function applyLinkedStatusEvent(transaction, message, event) {
    const existing = await transaction.whatsAppMessageStatusEvent.findUnique({
        where: {
            messageLogId_status_providerTimestamp: {
                messageLogId: message.id,
                status: event.status,
                providerTimestamp: event.providerTimestamp,
            },
        },
        select: { id: true },
    });
    if (!existing) {
        await transaction.whatsAppMessageStatusEvent.create({
            data: {
                messageLogId: message.id,
                status: event.status,
                providerTimestamp: event.providerTimestamp,
                providerErrorCode: event.providerErrorCode,
            },
        });
    }

    const currentTime = message.statusUpdatedAt?.getTime();
    const eventTime = event.providerTimestamp.getTime();
    const newer = currentTime === undefined
        || eventTime > currentTime
        || (eventTime === currentTime && STATUS_RANK[event.status] > STATUS_RANK[message.deliveryStatus]);
    const advancesStatus = STATUS_RANK[event.status] > STATUS_RANK[message.deliveryStatus];
    const repeatsCurrentStatus = event.status === message.deliveryStatus;
    if (newer && (advancesStatus || repeatsCurrentStatus)) {
        await transaction.whatsAppMessageLog.update({
            where: { id: message.id },
            data: { deliveryStatus: event.status, statusUpdatedAt: event.providerTimestamp },
        });
        message.deliveryStatus = event.status;
        message.statusUpdatedAt = event.providerTimestamp;
    }
}

export async function reconcilePendingWhatsAppStatusEvents(transaction, messageLogId, providerMessageId) {
    const message = await transaction.whatsAppMessageLog.findUnique({
        where: { id: messageLogId },
        select: { id: true, deliveryStatus: true, statusUpdatedAt: true },
    });
    if (!message) throw new Error("WhatsApp message log was not found during status reconciliation.");

    const pendingEvents = await transaction.whatsAppPendingStatusEvent.findMany({
        where: { providerMessageId },
        orderBy: [{ providerTimestamp: "asc" }, { id: "asc" }],
        select: {
            id: true,
            status: true,
            providerTimestamp: true,
            providerErrorCode: true,
        },
    });
    for (const event of pendingEvents) {
        await applyLinkedStatusEvent(transaction, message, event);
    }
    if (pendingEvents.length > 0) {
        await transaction.whatsAppPendingStatusEvent.deleteMany({
            where: { providerMessageId },
        });
    }
    return pendingEvents.length;
}

export async function reconcileUnmatchedWhatsAppStatusEvents(prismaClient, { messageLogId, providerMessageId }) {
    if (!Number.isSafeInteger(messageLogId) || messageLogId < 1
        || typeof providerMessageId !== "string" || !providerMessageId || providerMessageId.length > 255) {
        throw new Error("A valid message log ID and provider message ID are required.");
    }

    return prismaClient.$transaction(async (transaction) => {
        await lockWhatsAppProviderMessage(transaction, providerMessageId);
        const message = await transaction.whatsAppMessageLog.findUnique({
            where: { id: messageLogId },
            select: { id: true, providerMessageId: true, deliveryStatus: true, sentAt: true },
        });
        if (!message) throw new Error("The confirmed WhatsApp message log was not found.");

        const providerMessage = await transaction.whatsAppMessageLog.findUnique({
            where: { providerMessageId },
            select: { id: true },
        });
        if (providerMessage && providerMessage.id !== messageLogId) {
            throw new Error("The provider message ID is already assigned to another message log.");
        }

        const outbox = await transaction.whatsAppMessageOutbox.findUnique({
            where: { messageLogId },
            select: { id: true, status: true, claimToken: true },
        });
        if (!outbox) throw new Error("The confirmed WhatsApp message has no outbox record.");

        const alreadyLinked = message.providerMessageId === providerMessageId && outbox.status === "SENT";
        if (!alreadyLinked) {
            if (message.providerMessageId !== null
                || !["PENDING", "SENT"].includes(message.deliveryStatus)
                || !["UNKNOWN", "SUBMITTING"].includes(outbox.status)) {
                throw new Error("The message or outbox state is not eligible for manual reconciliation.");
            }

            const pendingEvent = await transaction.whatsAppPendingStatusEvent.findFirst({
                where: { providerMessageId },
                select: { id: true },
            });
            if (!pendingEvent) throw new Error("No unmatched status events exist for the provider message ID.");

            const now = new Date();
            const linked = await transaction.whatsAppMessageLog.updateMany({
                where: { id: messageLogId, providerMessageId: null },
                data: {
                    providerMessageId,
                    deliveryStatus: "SENT",
                    sentAt: message.sentAt ?? now,
                    statusUpdatedAt: null,
                },
            });
            if (linked.count !== 1) throw new Error("The message log changed during manual reconciliation.");

            const completed = await transaction.whatsAppMessageOutbox.updateMany({
                where: { id: outbox.id, status: outbox.status, claimToken: outbox.claimToken },
                data: {
                    status: "SENT",
                    completedAt: now,
                    claimToken: null,
                    lastErrorCode: null,
                },
            });
            if (completed.count !== 1) throw new Error("The outbox record changed during manual reconciliation.");
        }

        const reconciledCount = await reconcilePendingWhatsAppStatusEvents(
            transaction,
            messageLogId,
            providerMessageId,
        );
        return {
            alreadyReconciled: alreadyLinked && reconciledCount === 0,
            reconciledCount,
        };
    });
}

async function processStatusEvent(prismaClient, statusEvent) {
    if (!statusEvent || typeof statusEvent !== "object" || Array.isArray(statusEvent)) return;
    const status = META_STATUS[statusEvent.status];
    const providerTimestamp = parseProviderTimestamp(statusEvent.timestamp);
    if (!status || !providerTimestamp || typeof statusEvent.id !== "string"
        || !statusEvent.id || statusEvent.id.length > 255) return;

    try {
        await prismaClient.$transaction(async (tx) => {
            await lockWhatsAppProviderMessage(tx, statusEvent.id);
            const message = await tx.whatsAppMessageLog.findUnique({
                where: { providerMessageId: statusEvent.id },
                select: { id: true, deliveryStatus: true, statusUpdatedAt: true },
            });
            const event = {
                status,
                providerTimestamp,
                providerErrorCode: statusEventErrorCode(statusEvent, status),
            };
            if (!message) {
                await tx.whatsAppPendingStatusEvent.create({
                    data: {
                        providerMessageId: statusEvent.id,
                        ...event,
                    },
                });
                return;
            }
            await applyLinkedStatusEvent(tx, message, event);
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
    }
}

function isVerifiedPhone(value, configuredPhoneNumberId) {
    return typeof value === "string" && value === configuredPhoneNumberId;
}

export function createWhatsAppController({
    prismaClient = prisma,
    environment = process.env,
} = {}) {
    return {
        recordConsent: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const input = parseConsentBody(req.body);

            const result = await prismaClient.$transaction(async (transaction) => {
                const customer = await findAccessibleCustomer(transaction, req, customerId);
                await lockCustomerForWhatsApp(transaction, customer.id);
                await findAccessibleCustomer(transaction, req, customerId);
                const existing = await latestConsent(transaction, customerId);
                if (existing?.status === "OPTED_OUT") return { consent: existing, created: false };
                const consent = await transaction.whatsAppConsentEvent.create({
                    data: {
                        customerId,
                        recordedByUserId: req.user.id,
                        consentAt: new Date(),
                        ...input,
                    },
                    select: { id: true, status: true, source: true, recordedAt: true },
                });
                return { consent, created: true };
            });
            res.status(result.created ? 201 : 200).json({ success: true, data: { consent: result.consent } });
        },

        sendTextMessage: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const { messageContent, messageType } = parseMessageBody(req.body);
            const idempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
            const payloadFingerprint = idempotencyKey ? messagePayloadFingerprint(messageContent, messageType) : null;
            let result;

            try {
                result = await prismaClient.$transaction(async (transaction) => {
                    let customer = await findAccessibleCustomer(transaction, req, customerId);
                    await lockCustomerForWhatsApp(transaction, customer.id);
                    customer = await findAccessibleCustomer(transaction, req, customerId);

                    if (idempotencyKey) {
                        const existing = await findIdempotentMessage(
                            transaction,
                            req.user.id,
                            customerId,
                            idempotencyKey,
                        );
                        if (existing) {
                            if (existing.payloadFingerprint !== payloadFingerprint) {
                                throw new AppError(409, "Idempotency-Key was already used with a different message.");
                            }
                            return { message: existing.messageLog, created: false };
                        }
                    }

                    const consent = await latestConsent(transaction, customerId);
                    if (consent?.status !== "OPTED_IN") {
                        throw new AppError(409, "Recorded WhatsApp opt-in is required before messaging this customer.");
                    }
                    if (!isWithinCustomerServiceWindow(customer.lastWhatsappInboundAt)) {
                        throw new AppError(409, "Free-form text messages require an inbound WhatsApp message within the last 24 hours.");
                    }
                    customerPhoneForWhatsApp(customer.phone);
                    getMetaWhatsAppSendConfig(environment);

                    const message = await transaction.whatsAppMessageLog.create({
                        data: {
                            customerId,
                            triggeredByUserId: req.user.id,
                            messageType,
                            messageContent,
                            deliveryStatus: "PENDING",
                        },
                        select: messageWriteSelect,
                    });
                    const outbox = await transaction.whatsAppMessageOutbox.create({
                        data: { messageLogId: message.id },
                        select: { status: true, attemptCount: true },
                    });
                    if (idempotencyKey) {
                        await transaction.whatsAppMessageIdempotency.create({
                            data: {
                                senderUserId: req.user.id,
                                customerId,
                                idempotencyKey,
                                payloadFingerprint,
                                messageLogId: message.id,
                            },
                        });
                    }
                    return { message: { ...message, outbox }, created: true };
                });
            } catch (error) {
                if (!idempotencyKey || !isUniqueConstraintError(error)) throw error;
                const existing = await findIdempotentMessage(
                    prismaClient,
                    req.user.id,
                    customerId,
                    idempotencyKey,
                );
                if (!existing) throw error;
                if (existing.payloadFingerprint !== payloadFingerprint) {
                    throw new AppError(409, "Idempotency-Key was already used with a different message.");
                }
                result = { message: existing.messageLog, created: false };
            }

            res.status(result.created ? 202 : 200).json({
                success: true,
                data: idempotentResponse(result.message),
            });
        },

        listMessageHistory: async (req, res) => {
            const customerId = parsePositiveInteger(req.params.customerId, "customerId");
            const page = parsePage(req.query.page, DEFAULT_PAGE, "page");
            const pageSize = parsePage(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const skip = (page - 1) * pageSize;
            if (!Number.isSafeInteger(skip)) throw new AppError(400, "page is too large.");
            await findAccessibleCustomer(prismaClient, req, customerId);

            const where = { customerId };
            const [messages, total] = await prismaClient.$transaction([
                prismaClient.whatsAppMessageLog.findMany({
                    where,
                    select: messageSelect,
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    skip,
                    take: pageSize,
                }),
                prismaClient.whatsAppMessageLog.count({ where }),
            ]);
            res.status(200).json({
                success: true,
                data: {
                    messages,
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
                },
            });
        },

        verifyWebhook: (req, res) => {
            const { verifyToken } = getMetaWhatsAppWebhookConfig(environment);
            const mode = req.query["hub.mode"];
            const suppliedToken = req.query["hub.verify_token"];
            const challenge = req.query["hub.challenge"];
            if (mode !== "subscribe" || typeof suppliedToken !== "string" || !timingSafeStringEqual(suppliedToken, verifyToken)
                || typeof challenge !== "string" || challenge.length > 1024) {
                return res.status(403).type("text/plain").send("Forbidden");
            }
            return res.status(200).type("text/plain").send(challenge);
        },

        receiveWebhook: async (req, res) => {
            const { appSecret, phoneNumberId } = getMetaWhatsAppWebhookConfig(environment);
            if (!Buffer.isBuffer(req.body)) {
                throw new AppError(400, "WhatsApp webhook body must be JSON.");
            }
            if (!verifyMetaWebhookSignature(req.body, req.get("X-Hub-Signature-256"), appSecret)) {
                throw new AppError(401, "Invalid webhook signature.");
            }
            let payload;
            try {
                payload = JSON.parse(req.body.toString("utf8"));
            } catch {
                throw new AppError(400, "Invalid WhatsApp webhook payload.");
            }
            if (!payload || payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
                throw new AppError(400, "Invalid WhatsApp webhook payload.");
            }

            for (const entry of payload.entry) {
                if (!entry || !Array.isArray(entry.changes)) {
                    throw new AppError(400, "Invalid WhatsApp webhook payload.");
                }
                for (const change of entry.changes) {
                    if (!change || typeof change !== "object" || Array.isArray(change)) {
                        throw new AppError(400, "Invalid WhatsApp webhook payload.");
                    }
                    const value = change?.value;
                    if (!isVerifiedPhone(value?.metadata?.phone_number_id, phoneNumberId)) continue;
                    if (value.statuses !== undefined && !Array.isArray(value.statuses)) {
                        throw new AppError(400, "Invalid WhatsApp webhook payload.");
                    }
                    if (value.messages !== undefined && !Array.isArray(value.messages)) {
                        throw new AppError(400, "Invalid WhatsApp webhook payload.");
                    }
                    for (const status of value.statuses ?? []) {
                        await processStatusEvent(prismaClient, status);
                    }
                    for (const inbound of value.messages ?? []) {
                        await processInboundMessage(prismaClient, inbound);
                    }
                }
            }

            return res.status(200).json({ success: true });
        },
    };
}

export { messageSelect, messageWriteSelect };
