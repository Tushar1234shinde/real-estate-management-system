import { Router } from "express";
import { createVisitScheduleController } from "../controllers/visitScheduleController.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createVisitScheduleRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createVisitScheduleController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });

    router.post(
        "/:scheduleId/visit",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(controller.initializeVisit),
    );
    return router;
}
