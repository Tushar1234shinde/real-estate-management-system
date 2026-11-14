import { Router } from "express";
import { createAdminDashboardController } from "../controllers/adminDashboardController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createAdminDashboardRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAdminDashboardController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];

    router.get("/dashboard", ...protect, asyncHandler(controller.dashboard));
    router.get("/profile", ...protect, asyncHandler(controller.profile));

    return router;
}
