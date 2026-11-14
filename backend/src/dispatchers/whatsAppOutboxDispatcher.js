import { randomUUID } from "node:crypto";
import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { createMetaWhatsAppClient } from "../integrations/metaWhatsApp.js";
import {
    customerPhoneForWhatsApp,
    isWithinCustomerServiceWindow,
    latestConsent,
    lockCustomerForWhatsApp,
    lockWhatsAppProviderMessage,
    reconcilePendingWhatsAppStatusEvents,
} from "../controllers/whatsAppController.js";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_STALE_AFTER_MS = 60_000;
const DEFAULT_BATCH_SIZE = 10;
const MAX_PROCESSING_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;
const FINALIZATION_RETRIES = 3;

async function claimNextPending(prismaClient) {
    const candidate = await prismaClient.whatsAppMessageOutbox.findFirst({
        where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
            id: true,
            messageLogId: true,
            messageLog: { select: { customerId: true } },
        },
    });
    if (!candidate) return null;

    const claimToken = randomUUID();
    const processingStartedAt = new Date();
    const result = await prismaClient.$transaction(async (transaction) => {
        const claimed = await transaction.whatsAppMessageOutbox.updateMany({
            where: { id: candidate.id, status: "PENDING" },
            data: {
                status: "PROCESSING",
                claimToken,
                processingStartedAt,
                attemptCount: { increment: 1 },
                completedAt: null,
                lastErrorCode: null,
            },
        });
        return claimed.count === 1;
    });

    return result ? {
        id: candidate.id,
        messageLogId: candidate.messageLogId,
        customerId: candidate.messageLog.customerId,
        claimToken,
    } : null;
}

async function markBeforeSubmissionFailure(transaction, claim, status, errorCode, now) {
    const updated = await transaction.whatsAppMessageOutbox.updateMany({
        where: {
            id: claim.id,
            status: "PROCESSING",
            claimToken: claim.claimToken,
        },
        data: {
            status,
            completedAt: now,
            claimToken: null,
            lastErrorCode: errorCode,
        },
    });
    if (updated.count !== 1) return false;

    await transaction.whatsAppMessageLog.update({
        where: { id: claim.messageLogId },
        data: { deliveryStatus: "FAILED", statusUpdatedAt: now },
        select: { id: true },
    });
    return true;
}

async function beginSubmission(prismaClient, claim) {
    return prismaClient.$transaction(async (transaction) => {
        await lockCustomerForWhatsApp(transaction, claim.customerId);

        const outbox = await transaction.whatsAppMessageOutbox.findUnique({
            where: { id: claim.id },
            select: { status: true, claimToken: true },
        });
        if (outbox?.status !== "PROCESSING" || outbox.claimToken !== claim.claimToken) {
            return { kind: "LOST_CLAIM" };
        }

        const customer = await transaction.customer.findUnique({
            where: { id: claim.customerId },
            select: { id: true, phone: true, lastWhatsappInboundAt: true },
        });
        const consent = await latestConsent(transaction, claim.customerId);
        const now = new Date();

        if (consent?.status !== "OPTED_IN") {
            await markBeforeSubmissionFailure(transaction, claim, "CANCELLED", "CONSENT_NOT_OPTED_IN", now);
            return { kind: "CANCELLED" };
        }
        if (!customer || !isWithinCustomerServiceWindow(customer.lastWhatsappInboundAt, now.getTime())) {
            await markBeforeSubmissionFailure(transaction, claim, "CANCELLED", "SERVICE_WINDOW_CLOSED", now);
            return { kind: "CANCELLED" };
        }

        let to;
        try {
            to = customerPhoneForWhatsApp(customer.phone);
        } catch (error) {
            if (!(error instanceof AppError)) throw error;
            await markBeforeSubmissionFailure(transaction, claim, "FAILED", "INVALID_CUSTOMER_PHONE", now);
            return { kind: "FAILED" };
        }

        const message = await transaction.whatsAppMessageLog.findUnique({
            where: { id: claim.messageLogId },
            select: { messageContent: true },
        });
        if (!message) {
            await markBeforeSubmissionFailure(transaction, claim, "FAILED", "MESSAGE_LOG_MISSING", now);
            return { kind: "FAILED" };
        }

        const updated = await transaction.whatsAppMessageOutbox.updateMany({
            where: {
                id: claim.id,
                status: "PROCESSING",
                claimToken: claim.claimToken,
            },
            data: {
                status: "SUBMITTING",
                submissionStartedAt: now,
            },
        });
        if (updated.count !== 1) return { kind: "LOST_CLAIM" };
        return { kind: "SUBMITTING", to, message: message.messageContent };
    });
}

async function finishSubmission(prismaClient, claim, status, providerMessageId = null) {
    const now = new Date();
    const lastErrorCode = status === "UNKNOWN" ? "PROVIDER_OUTCOME_UNKNOWN"
        : status === "FAILED" ? "PROVIDER_REJECTED"
            : null;

    return prismaClient.$transaction(async (transaction) => {
        if (status === "SENT") {
            await lockWhatsAppProviderMessage(transaction, providerMessageId);
        }
        const updated = await transaction.whatsAppMessageOutbox.updateMany({
            where: {
                id: claim.id,
                status: "SUBMITTING",
                claimToken: claim.claimToken,
            },
            data: {
                status,
                completedAt: now,
                claimToken: null,
                lastErrorCode,
            },
        });
        if (updated.count !== 1) return false;

        if (status === "SENT") {
            await transaction.whatsAppMessageLog.update({
                where: { id: claim.messageLogId },
                data: {
                    providerMessageId,
                    deliveryStatus: "SENT",
                    sentAt: now,
                },
                select: { id: true },
            });
            await reconcilePendingWhatsAppStatusEvents(
                transaction,
                claim.messageLogId,
                providerMessageId,
            );
        } else if (status === "FAILED") {
            await transaction.whatsAppMessageLog.update({
                where: { id: claim.messageLogId },
                data: { deliveryStatus: "FAILED", statusUpdatedAt: now },
                select: { id: true },
            });
        }
        return true;
    });
}

async function finishSubmissionWithRetry(prismaClient, claim, status, providerMessageId = null) {
    let lastError;
    for (let attempt = 0; attempt < FINALIZATION_RETRIES; attempt += 1) {
        try {
            return await finishSubmission(prismaClient, claim, status, providerMessageId);
        } catch (error) {
            lastError = error;
            if (attempt + 1 < FINALIZATION_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}

export function createWhatsAppOutboxDispatcher({
    prismaClient = prisma,
    metaWhatsAppClient = createMetaWhatsAppClient(),
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    batchSize = DEFAULT_BATCH_SIZE,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
} = {}) {
    if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1
        || !Number.isInteger(staleAfterMs) || staleAfterMs < 1
        || !Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error("WhatsApp outbox dispatcher timing and batch settings must be positive integers.");
    }

    let timer = null;
    let running = null;
    let stopped = true;

    async function recoverStale() {
        const cutoff = new Date(Date.now() - staleAfterMs);
        const staleClaims = await prismaClient.whatsAppMessageOutbox.findMany({
            where: { status: "PROCESSING", processingStartedAt: { lt: cutoff } },
            select: { id: true, messageLogId: true, attemptCount: true },
        });
        let requeued = 0;
        let failed = 0;
        for (const claim of staleClaims) {
            const now = new Date();
            const exhausted = claim.attemptCount >= MAX_PROCESSING_ATTEMPTS;
            const backoffMs = Math.min(
                BASE_RETRY_DELAY_MS * (2 ** Math.max(0, claim.attemptCount - 1)),
                MAX_RETRY_DELAY_MS,
            );
            const result = await prismaClient.$transaction(async (transaction) => {
                const updated = await transaction.whatsAppMessageOutbox.updateMany({
                    where: {
                        id: claim.id,
                        status: "PROCESSING",
                        processingStartedAt: { lt: cutoff },
                    },
                    data: exhausted
                        ? {
                            status: "FAILED",
                            claimToken: null,
                            completedAt: now,
                            lastErrorCode: "CLAIM_ATTEMPTS_EXHAUSTED",
                        }
                        : {
                            status: "PENDING",
                            claimToken: null,
                            processingStartedAt: null,
                            nextAttemptAt: new Date(now.getTime() + backoffMs),
                            lastErrorCode: "CLAIM_LEASE_EXPIRED",
                        },
                });
                if (updated.count !== 1) return false;
                if (exhausted) {
                    await transaction.whatsAppMessageLog.update({
                        where: { id: claim.messageLogId },
                        data: { deliveryStatus: "FAILED", statusUpdatedAt: now },
                        select: { id: true },
                    });
                }
                return true;
            });
            if (result) {
                if (exhausted) failed += 1;
                else requeued += 1;
            }
        }
        const recoveredAfterSubmission = await prismaClient.whatsAppMessageOutbox.updateMany({
            where: { status: "SUBMITTING", submissionStartedAt: { lt: cutoff } },
            data: {
                status: "UNKNOWN",
                claimToken: null,
                completedAt: new Date(),
                lastErrorCode: "STALE_SUBMISSION_UNKNOWN",
            },
        });
        return {
            requeued,
            failed,
            unknown: recoveredAfterSubmission.count,
        };
    }

    async function dispatchOne() {
        const claim = await claimNextPending(prismaClient);
        if (!claim) return { processed: false, status: null };

        const submission = await beginSubmission(prismaClient, claim);
        if (submission.kind !== "SUBMITTING") {
            return { processed: true, status: submission.kind };
        }

        let accepted;
        try {
            accepted = await metaWhatsAppClient.sendTextMessage({
                to: submission.to,
                message: submission.message,
            });
        } catch (error) {
            const status = error?.dispatchOutcome === "UNKNOWN" ? "UNKNOWN" : "FAILED";
            await finishSubmissionWithRetry(prismaClient, claim, status);
            return { processed: true, status };
        }
        if (typeof accepted?.providerMessageId !== "string" || !accepted.providerMessageId) {
            await finishSubmissionWithRetry(prismaClient, claim, "UNKNOWN");
            return { processed: true, status: "UNKNOWN" };
        }
        await finishSubmissionWithRetry(prismaClient, claim, "SENT", accepted.providerMessageId);
        return { processed: true, status: "SENT" };
    }

    async function dispatchOnce() {
        await recoverStale();
        return dispatchOne();
    }

    async function runBatch() {
        await recoverStale();
        for (let index = 0; index < batchSize && !stopped; index += 1) {
            const result = await dispatchOne();
            if (!result.processed) return;
        }
    }

    function schedule(delay = pollIntervalMs) {
        if (stopped || timer !== null) return;
        timer = setTimeoutFn(() => {
            timer = null;
            running = runBatch()
                .catch(() => {
                    console.error(JSON.stringify({
                        level: "error",
                        event: "whatsapp_outbox_cycle_failed",
                    }));
                })
                .finally(() => {
                    running = null;
                    schedule();
                });
        }, delay);
        timer.unref?.();
    }

    function start() {
        if (!stopped) return;
        stopped = false;
        schedule(0);
    }

    async function stop() {
        stopped = true;
        if (timer !== null) {
            clearTimeoutFn(timer);
            timer = null;
        }
        if (running) await running;
    }

    return { start, stop, dispatchOnce, recoverStale };
}
