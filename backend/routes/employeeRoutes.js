
import express from "express";
import {
    addEmployee,
    getAllEmployees
} from "../controllers/employeeController.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only Admin can add employees
router.post(
    "/",
    verifyToken,
    authorizeRoles("ADMIN"),
    addEmployee
);

// Only Admin can view all employees
router.get(
    "/",
    verifyToken,
    authorizeRoles("ADMIN"),
    getAllEmployees
);

export default router;
