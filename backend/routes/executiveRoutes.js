
import express from "express";

import {
    addEmployee,
    getAllEmployees
} from "../controllers/employeeController.js";

import {
    addCustomer,
    getAllCustomers,
    assignCustomer
} from "../controllers/customerController.js";

import {
    verifyToken,
    authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Executive: Add employee
router.post(
    "/employees",
    verifyToken,
    authorizeRoles("EXECUTIVE"),
    addEmployee
);

// Executive: View employees
router.get(
    "/employees",
    verifyToken,
    authorizeRoles("EXECUTIVE"),
    getAllEmployees
);

// Executive: Add customer
router.post(
    "/customers",
    verifyToken,
    authorizeRoles("EXECUTIVE"),
    addCustomer
);

// Executive: View customers
router.get(
    "/customers",
    verifyToken,
    authorizeRoles("EXECUTIVE"),
    getAllCustomers
);

// Executive: Assign customer
router.post(
    "/customers/assign",
    verifyToken,
    authorizeRoles("EXECUTIVE"),
    assignCustomer
);

export default router;
