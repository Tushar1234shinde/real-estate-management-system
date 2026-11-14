import { Router } from "express";
import { createAdminEmployeeController } from "../controllers/adminEmployeeController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createAdminEmployeeRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAdminEmployeeController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.ADMIN, ROLES.EXECUTIVE)];

    router.get("/employees", ...protect, asyncHandler(controller.listEmployees));
    router.post("/employees", ...protect, asyncHandler(controller.createEmployee));
    router.get("/employees/:employeeId", ...protect, asyncHandler(controller.getEmployee));
    router.patch("/employees/:employeeId", ...protect, asyncHandler(controller.updateEmployee));
    router.patch("/employees/:employeeId/status", ...protect, asyncHandler(controller.updateEmployeeStatus));

    return router;
}
