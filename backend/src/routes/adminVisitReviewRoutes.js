import { Router } from "express";
import { createAdminVisitReviewController } from "../controllers/adminVisitReviewController.js";
import { createAuthenticate, authorizeRoles, ROLES } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export function createAdminVisitReviewRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience, cloudinaryClient, environment } = {}) {
    const router = Router();
    const controller = createAdminVisitReviewController({ prismaClient, cloudinaryClient, environment });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];

    router.get("/visits/pending-review", ...protect, asyncHandler(controller.listPendingReviews));
    router.get("/visits/:visitId/review", ...protect, asyncHandler(controller.getReviewDetails));
    router.get("/visits/:visitId/evidence/:mediaId/access", ...protect, asyncHandler(controller.getEvidenceAccessUrl));
    router.patch("/visits/:visitId/approve", ...protect, asyncHandler(controller.approveVisit));
    router.patch("/visits/:visitId/reject", ...protect, asyncHandler(controller.rejectVisit));
    return router;
}
