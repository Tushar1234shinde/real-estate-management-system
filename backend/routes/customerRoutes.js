
import express from "express";
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

// Only Admin can add customers
router.post(
    "/",
    verifyToken,
    authorizeRoles("ADMIN"),
    addCustomer
);

// Only Admin can get all customers
router.get(
    "/",
    verifyToken,
    authorizeRoles("ADMIN"),
    getAllCustomers
);

// Only Admin can assign customers
router.post(
    "/assign",
    verifyToken,
    authorizeRoles("ADMIN"),
    assignCustomer
);

export default router;
