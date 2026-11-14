import { Router } from "express";
import { createWhatsAppController } from "../controllers/whatsAppController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createWhatsAppWebhookRouter({ prismaClient, environment } = {}) {
    const router = Router();
    const controller = createWhatsAppController({ prismaClient, environment });

    router.get("/", asyncHandler(controller.verifyWebhook));
    router.post("/", asyncHandler(controller.receiveWebhook));
    return router;
}
