import { Router } from "express";
import { createVisitScheduleController } from "../controllers/visitScheduleController.js";
import { createVisitSubmissionController } from "../controllers/visitSubmissionController.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createVisitRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createVisitScheduleController({ prismaClient });
    const submissionController = createVisitSubmissionController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });

    router.post(
        "/:visitId/verify-location",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(controller.verifyLocation),
    );
    router.post(
        "/:visitId/submit",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(submissionController.submitVisit),
    );

    return router;
}
