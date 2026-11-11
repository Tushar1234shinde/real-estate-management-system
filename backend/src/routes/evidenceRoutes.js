import { Router } from "express";
import { createEvidenceController } from "../controllers/evidenceController.js";
import { createEvidenceUpload, multerErrorHandler } from "../utils/evidence.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createEvidenceRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience, cloudinaryClient, environment } = {}) {
    const router = Router();
    const controller = createEvidenceController({ prismaClient, cloudinaryClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.OUTSIDE_SALES)];

    router.post("/:visitId/evidence/selfie", ...protect, multerErrorHandler(createEvidenceUpload("selfie", environment)), asyncHandler(controller.uploadSelfie));
    router.post("/:visitId/evidence/audio", ...protect, multerErrorHandler(createEvidenceUpload("audio", environment)), asyncHandler(controller.uploadAudio));
    return router;
}
