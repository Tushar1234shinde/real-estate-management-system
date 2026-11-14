import { Router } from "express";
import { createCallLogController } from "../controllers/callLogController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createOutsideSalesCallLogRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router(); const controller = createCallLogController({ prismaClient });
    const protect = [createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience }), authorizeRoles(ROLES.OUTSIDE_SALES)];
    router.get("/customers/:customerId/call-logs", ...protect, asyncHandler(controller.listOwnCustomerLogs));
    router.post("/customers/:customerId/call-logs", ...protect, asyncHandler(controller.createOwnCustomerLog));
    return router;
}
export function createAdminCallLogRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router(); const controller = createCallLogController({ prismaClient });
    const protect = [createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience }), authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];
    router.get("/call-logs", ...protect, asyncHandler(controller.listOrganizationLogs));
    router.get("/call-logs/statistics", ...protect, asyncHandler(controller.statistics));
    return router;
}
