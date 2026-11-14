import { Router } from "express";
import { createAnnouncementController } from "../controllers/announcementController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createAnnouncementRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAnnouncementController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const managers = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];
    router.get("/", authenticate, asyncHandler(controller.list));
    router.post("/", ...managers, asyncHandler(controller.create));
    router.get("/:announcementId", authenticate, asyncHandler(controller.get));
    router.patch("/:announcementId", ...managers, asyncHandler(controller.update));
    router.delete("/:announcementId", ...managers, asyncHandler(controller.remove));
    router.post("/:announcementId/read", authenticate, asyncHandler(controller.markRead));
    return router;
}

export function createAdminAnnouncementRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAnnouncementController({ prismaClient });
    router.get("/announcements/:announcementId/read-statistics", createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience }), authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE), asyncHandler(controller.readStatistics));
    return router;
}
