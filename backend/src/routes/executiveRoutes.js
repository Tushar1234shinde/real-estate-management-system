import { Router } from "express";
import { createAdminCustomerController } from "../controllers/adminCustomerController.js";
import { createAdminEmployeeController } from "../controllers/adminEmployeeController.js";
import { createAdminDashboardController } from "../controllers/adminDashboardController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createExecutiveRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const employeeController = createAdminEmployeeController({ prismaClient });
    const customerController = createAdminCustomerController({ prismaClient });
    const dashboardController = createAdminDashboardController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.EXECUTIVE)];

    router.get("/dashboard", ...protect, asyncHandler(dashboardController.dashboard));
    router.get("/profile", ...protect, asyncHandler(dashboardController.profile));
    router.get("/employees", ...protect, asyncHandler(employeeController.listEmployees));
    router.post("/employees", ...protect, asyncHandler(employeeController.createEmployee));
    router.get("/customers", ...protect, asyncHandler(customerController.listCustomers));
    router.post("/customers", ...protect, asyncHandler(customerController.createCustomer));
    router.post("/customers/import", ...protect, asyncHandler(customerController.importCustomers));
    router.post("/assignments", ...protect, asyncHandler(customerController.assignCustomerFromBody));

    return router;
}
