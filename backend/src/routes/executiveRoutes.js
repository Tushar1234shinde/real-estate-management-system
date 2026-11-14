import { Router } from "express";
import { createAdminCustomerController } from "../controllers/adminCustomerController.js";
import { createAdminEmployeeController } from "../controllers/adminEmployeeController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createExecutiveRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const employeeController = createAdminEmployeeController({ prismaClient });
    const customerController = createAdminCustomerController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const protect = [authenticate, authorizeRoles(ROLES.EXECUTIVE)];

    router.get("/employees", ...protect, asyncHandler(employeeController.listEmployees));
    router.post("/employees", ...protect, asyncHandler(employeeController.createEmployee));
    router.get("/customers", ...protect, asyncHandler(customerController.listCustomers));
    router.post("/customers", ...protect, asyncHandler(customerController.createCustomer));
    router.post("/assignments", ...protect, asyncHandler(customerController.assignCustomerFromBody));

    return router;
}
