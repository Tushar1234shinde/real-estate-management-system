import { AppError } from "../errors/AppError.js";

function requiredValue(environment, name) {
    const value = environment[name]?.trim();
    if (!value) throw new AppError(503, "Meta WhatsApp integration is not configured.");
    return value;
}

export function getMetaWhatsAppSendConfig(environment = process.env) {
    const accessToken = requiredValue(environment, "META_WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = requiredValue(environment, "META_WHATSAPP_PHONE_NUMBER_ID");
    const graphApiVersion = requiredValue(environment, "META_GRAPH_API_VERSION");

    if (!/^\d+$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(graphApiVersion)) {
        throw new AppError(503, "Meta WhatsApp integration is not configured.");
    }

    return { accessToken, phoneNumberId, graphApiVersion };
}

export function getMetaWhatsAppWebhookConfig(environment = process.env) {
    const verifyToken = requiredValue(environment, "META_WHATSAPP_VERIFY_TOKEN");
    const appSecret = requiredValue(environment, "META_WHATSAPP_APP_SECRET");
    const phoneNumberId = requiredValue(environment, "META_WHATSAPP_PHONE_NUMBER_ID");

    if (!/^\d+$/.test(phoneNumberId)) {
        throw new AppError(503, "Meta WhatsApp integration is not configured.");
    }

    return { verifyToken, appSecret, phoneNumberId };
}
