
const express = require("express");
const router = express.Router();

const adminController = require("./admin.controller");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

// Admin-only dashboard statistics API.
router.get(
    "/dashboard/stats",
    authenticate,
    authorize("ADMIN"),
    adminController.getDashboardStats
);

// Admin-only employee list API.
// router.get(
//     "/employees",
//     authenticate,
//     authorize("ADMIN"),
//     adminController.getAllEmployees
// );

// Employee APIs accessible to both Admin and Executive.
router.get(
    "/employees",
    authenticate,
    authorize("ADMIN", "EXECUTIVE"),
    adminController.getAllEmployees
);

router.post(
    "/employees",
    authenticate,
    authorize("ADMIN", "EXECUTIVE"),
    adminController.createEmployee
);

router.patch(
    "/employees/:id/status",
    authenticate,
    authorize("ADMIN", "EXECUTIVE"),
    adminController.updateEmployeeStatus
);

// Admin-only daily attendance monitoring API.
router.get(
    "/attendance",
    authenticate,
    authorize("ADMIN"),
    adminController.getAttendance
);

// Admin-only read-only call monitoring API.
router.get(
    "/calls",
    authenticate,
    authorize("ADMIN"),
    adminController.getCalls
);

// Admin-only read-only visit monitoring API.
router.get(
    "/visits",
    authenticate,
    authorize("ADMIN"),
    adminController.getVisits
);

// Admin-only read-only WhatsApp message monitoring API.
router.get(
    "/whatsapp-logs",
    authenticate,
    authorize("ADMIN"),
    adminController.getWhatsAppLogs
);

// Admin-only read-only property monitoring API.
router.get(
    "/properties",
    authenticate,
    authorize("ADMIN"),
    adminController.getProperties
);
    
module.exports = router;
