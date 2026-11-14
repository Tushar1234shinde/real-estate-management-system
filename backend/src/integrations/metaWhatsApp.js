import { getMetaWhatsAppSendConfig } from "../config/metaWhatsApp.js";
import { AppError } from "../errors/AppError.js";

const PROVIDER_TIMEOUT_MS = 10_000;

function providerError(statusCode, message, dispatchOutcome) {
    const error = new AppError(statusCode, message);
    error.dispatchOutcome = dispatchOutcome;
    return error;
}

export function createMetaWhatsAppClient({
    environment = process.env,
    fetchImpl = globalThis.fetch,
    timeoutMs = PROVIDER_TIMEOUT_MS,
} = {}) {
    return {
        async sendTextMessage({ to, message }) {
            const { accessToken, phoneNumberId, graphApiVersion } = getMetaWhatsAppSendConfig(environment);
            const endpoint = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;

            let response;
            try {
                response = await fetchImpl(endpoint, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        to,
                        type: "text",
                        text: { body: message, preview_url: false },
                    }),
                    signal: AbortSignal.timeout(timeoutMs),
                });
            } catch {
                throw providerError(503, "Meta WhatsApp is temporarily unavailable.", "UNKNOWN");
            }

            let payload;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok) {
                const uncertain = response.status >= 500;
                throw providerError(
                    response.status === 429 || uncertain ? 503 : 502,
                    "Meta WhatsApp rejected the message.",
                    uncertain ? "UNKNOWN" : "FAILED",
                );
            }

            const providerMessageId = payload?.messages?.[0]?.id;
            if (typeof providerMessageId !== "string" || !providerMessageId) {
                throw providerError(502, "Meta WhatsApp returned an invalid response.", "UNKNOWN");
            }

            return { providerMessageId };
        },
    };
}
