import { Router } from "express";
import { createInsideSalesController } from "../controllers/insideSalesController.js";
import { createPropertyDocumentsController } from "../controllers/propertyDocumentsController.js";
import { createWhatsAppController } from "../controllers/whatsAppController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createInsideSalesRouter({
    prismaClient,
    jwtSecret,
    jwtIssuer,
    jwtAudience,
    cloudinaryClient,
    metaWhatsAppClient,
    environment,
} = {}) {
    const router = Router();
    const controller = createInsideSalesController({ prismaClient });
    const documentsController = createPropertyDocumentsController({ prismaClient, cloudinaryClient, environment });
    const whatsAppController = createWhatsAppController({ prismaClient, metaWhatsAppClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const insideSalesOnly = [authenticate, authorizeRoles(ROLES.INSIDE_SALES)];

    router.get("/customers", ...insideSalesOnly, asyncHandler(controller.listAssignedCustomers));
    router.get("/customers/:customerId", ...insideSalesOnly, asyncHandler(controller.getAssignedCustomer));
    router.get("/customers/:customerId/call-logs", ...insideSalesOnly, asyncHandler(controller.listCallLogs));
    router.post("/customers/:customerId/call-logs", ...insideSalesOnly, asyncHandler(controller.createCallLog));
    router.patch("/customers/:customerId/whatsapp-consent", ...insideSalesOnly, asyncHandler(whatsAppController.recordConsent));
    router.post("/customers/:customerId/whatsapp-messages", ...insideSalesOnly, asyncHandler(whatsAppController.sendTextMessage));
    router.get("/customers/:customerId/whatsapp-messages", ...insideSalesOnly, asyncHandler(whatsAppController.listMessageHistory));
    router.patch("/customers/:customerId/interest", ...insideSalesOnly, asyncHandler(controller.updateInterest));
    router.get("/properties", ...insideSalesOnly, asyncHandler(controller.listAvailableProperties));
    router.get("/properties/:propertyId/documents", ...insideSalesOnly, asyncHandler(documentsController.listDocuments));
    router.get(
        "/properties/:propertyId/documents/:documentId/access",
        ...insideSalesOnly,
        asyncHandler(documentsController.getDocumentAccess),
    );
    router.get("/visit-schedules", ...insideSalesOnly, asyncHandler(controller.listOwnedVisitSchedules));
    router.post("/visit-schedules", ...insideSalesOnly, asyncHandler(controller.createVisitSchedule));
    router.patch("/visit-schedules/:scheduleId", ...insideSalesOnly, asyncHandler(controller.updateVisitSchedule));
    router.get("/dashboard", ...insideSalesOnly, asyncHandler(controller.dashboard));
    router.get("/profile", ...insideSalesOnly, asyncHandler(controller.profile));

    return router;
}
