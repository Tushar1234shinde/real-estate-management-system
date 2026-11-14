import { Router } from "express";
import { createOutsideSalesController } from "../controllers/outsideSalesController.js";
import { createPropertyDocumentsController } from "../controllers/propertyDocumentsController.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createOutsideSalesCallLogRouter } from "./callLogRoutes.js";

export function createOutsideSalesRouter({
    prismaClient,
    jwtSecret,
    jwtIssuer,
    jwtAudience,
    cloudinaryClient,
    environment,
} = {}) {
    const router = Router();
    const controller = createOutsideSalesController({ prismaClient });
    const documentsController = createPropertyDocumentsController({ prismaClient, cloudinaryClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });

    router.get(
        "/properties/:propertyId/documents",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(documentsController.listDocuments),
    );
    router.use(createOutsideSalesCallLogRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience }));
    router.get(
        "/properties/:propertyId/documents/:documentId/access",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(documentsController.getDocumentAccess),
    );
    router.get(
        "/visit-schedules",
        authenticate,
        authorizeRoles(ROLES.OUTSIDE_SALES),
        asyncHandler(controller.listAssignedVisitSchedules),
    );

    return router;
}
