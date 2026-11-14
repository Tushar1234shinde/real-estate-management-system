import { Router } from "express";
import { createOfficeLocationController } from "../controllers/officeLocationController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createOfficeLocationRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createOfficeLocationController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN)];

    router.get("/", ...protect, asyncHandler(controller.listOfficeLocations));
    router.post("/", ...protect, asyncHandler(controller.createOfficeLocation));
    router.patch("/:id", ...protect, asyncHandler(controller.updateOfficeLocation));
    router.patch("/:id/toggle", ...protect, asyncHandler(controller.toggleOfficeLocationStatus));

    return router;
}
