
const express = require("express");

const customerController = require("./customer.controller");

const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

// Separate routers for Admin and Executive
const adminCustomerRouter = express.Router();
const executiveCustomerRouter = express.Router();
const executiveAssignmentRouter = express.Router();

// Admin permissions
adminCustomerRouter.use(authenticate);
adminCustomerRouter.use(authorize("ADMIN"));

// Executive permissions
executiveCustomerRouter.use(authenticate);
executiveCustomerRouter.use(authorize("EXECUTIVE"));

// Separate Executive assignment permissions
executiveAssignmentRouter.use(authenticate);
executiveAssignmentRouter.use(authorize("EXECUTIVE"));

// Shared customer routes
const registerCustomerRoutes = (router) => {

    // Get all customers
    router.get(
        "/",
        customerController.getAllCustomers
    );

    // Create customer
    router.post(
        "/",
        customerController.createCustomer
    );

    // Get customer assignment
    router.get(
        "/:customerId/assignment",
        customerController.getCustomerAssignment
    );

    // Assign customer to Inside Sales employee
    router.post(
        "/:customerId/assignment",
        customerController.assignCustomer
    );

    // Get customer details
    router.get(
        "/:customerId",
        customerController.getCustomerById
    );

    // Update customer
    router.patch(
        "/:customerId",
        customerController.updateCustomer
    );
};

// Register shared routes for both roles
registerCustomerRoutes(adminCustomerRouter);
registerCustomerRoutes(executiveCustomerRouter);

// Executive body-based assignment endpoint
executiveAssignmentRouter.post(
    "/assignments",
    customerController.assignCustomerFromBody
);

module.exports = {
    adminCustomerRouter,
    executiveCustomerRouter,
    executiveAssignmentRouter
};
