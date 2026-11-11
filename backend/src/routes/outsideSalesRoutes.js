import { Router } from "express";
import { createOutsideSalesController } from "../controllers/outsideSalesController.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createOutsideSalesRouter({ prismaClient, jwtSecret } = {}) {
    const router = Router();
    const controller = createOutsideSalesController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret });

    router.get(
        "/visit-schedules",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(controller.listAssignedVisitSchedules),
    );

    return router;
}
