import { Router } from "express";
import { createAdminCustomerController } from "../controllers/adminCustomerController.js";
import { createWhatsAppController } from "../controllers/whatsAppController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createAdminCustomerRouter({
    prismaClient,
    jwtSecret,
    jwtIssuer,
    jwtAudience,
    metaWhatsAppClient,
    environment,
} = {}) {
    const router = Router();
    const controller = createAdminCustomerController({ prismaClient });
    const whatsAppController = createWhatsAppController({ prismaClient, metaWhatsAppClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];

    router.get("/customers", ...protect, asyncHandler(controller.listCustomers));
    router.post("/customers", ...protect, asyncHandler(controller.createCustomer));
    router.get("/customers/:customerId/assignment", ...protect, asyncHandler(controller.getCustomerAssignment));
    router.post("/customers/:customerId/assignment", ...protect, asyncHandler(controller.assignCustomer));
    router.patch("/customers/:customerId/whatsapp-consent", ...protect, asyncHandler(whatsAppController.recordConsent));
    router.post("/customers/:customerId/whatsapp-messages", ...protect, asyncHandler(whatsAppController.sendTextMessage));
    router.get("/customers/:customerId/whatsapp-messages", ...protect, asyncHandler(whatsAppController.listMessageHistory));
    router.get("/customers/:customerId", ...protect, asyncHandler(controller.getCustomer));
    router.patch("/customers/:customerId", ...protect, asyncHandler(controller.updateCustomer));

    return router;
}
