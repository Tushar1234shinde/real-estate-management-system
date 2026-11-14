import { Router } from "express";
import { createAdminPropertyController } from "../controllers/adminPropertyController.js";
import { createPropertyDocumentsController } from "../controllers/propertyDocumentsController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";
import {
    createPropertyDocumentUpload,
    propertyDocumentMulterErrorHandler,
} from "../utils/propertyDocuments.js";

export function createAdminPropertyRouter({
    prismaClient,
    jwtSecret,
    jwtIssuer,
    jwtAudience,
    cloudinaryClient,
    environment,
} = {}) {
    const router = Router();
    const controller = createAdminPropertyController({ prismaClient });
    const documentsController = createPropertyDocumentsController({ prismaClient, cloudinaryClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];

    router.get("/properties", ...protect, asyncHandler(controller.listProperties));
    router.post("/properties", ...protect, asyncHandler(controller.createProperty));
    router.get("/properties/:propertyId", ...protect, asyncHandler(controller.getProperty));
    router.patch("/properties/:propertyId", ...protect, asyncHandler(controller.updateProperty));
    router.post(
        "/properties/:propertyId/documents",
        ...protect,
        propertyDocumentMulterErrorHandler(createPropertyDocumentUpload()),
        asyncHandler(documentsController.uploadDocuments),
    );
    router.get("/properties/:propertyId/documents", ...protect, asyncHandler(documentsController.listDocuments));
    router.get(
        "/properties/:propertyId/documents/:documentId/access",
        ...protect,
        asyncHandler(documentsController.getDocumentAccess),
    );
    router.delete(
        "/properties/:propertyId/documents/:documentId",
        ...protect,
        asyncHandler(documentsController.deleteDocument),
    );

    return router;
}
