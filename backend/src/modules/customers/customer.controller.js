
const customerService = require("./customer.service");

const sendError = (res, error) => {
    console.error("Customer Controller Error:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode
            ? error.message
            : "Internal server error"
    });
};

const parseCustomerId = (value) => {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone) => {
    return /^\+?[1-9]\d{7,14}$/.test(phone);
};

const CUSTOMER_FIELDS = [
    "fullName",
    "phone",
    "email",
    "address",
    "interestStatus"
];

// 1. Get all customers
const getAllCustomers = async (req, res) => {
    try {
        const result = await customerService.getAllCustomers(req.query);

        return res.status(200).json({
            success: true,
            message: "Customers fetched successfully",
            data: result
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 2. Create customer
const createCustomer = async (req, res) => {
    try {
        const { fullName, phone, email, address, interestStatus } = req.body;

        if (
            typeof fullName !== "string" ||
            !fullName.trim() ||
            fullName.trim().length > 120
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid customer name is required (maximum 120 characters)"
            });
        }

        if (
            typeof phone !== "string" ||
            !isValidPhone(phone.trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid phone number is required"
            });
        }

        if (
            email !== undefined &&
            email !== null &&
            email !== "" &&
            (
                typeof email !== "string" ||
                email.length > 254 ||
                !isValidEmail(email.trim())
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid email address is required"
            });
        }

        if (
            address !== undefined &&
            address !== null &&
            (
                typeof address !== "string" ||
                address.length > 500
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Address must not exceed 500 characters"
            });
        }

        if (
            interestStatus !== undefined &&
            !["PENDING", "INTERESTED", "NOT_INTERESTED"].includes(interestStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid interest status"
            });
        }

        const customer = await customerService.createCustomer({
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email ? email.trim() : null,
            address: address ? address.trim() : null,
            interestStatus
        });

        return res.status(201).json({
            success: true,
            message: "Customer created successfully",
            data: {
                customer
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 3. Get customer by ID
const getCustomerById = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.customerId);

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const customer = await customerService.getCustomerById(customerId);

        return res.status(200).json({
            success: true,
            message: "Customer fetched successfully",
            data: {
                customer
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 4. Update customer
const updateCustomer = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.customerId);
        const body = req.body;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid request body"
            });
        }

        const unexpectedFields = Object.keys(body).filter(
            field => !CUSTOMER_FIELDS.includes(field) &&
                     field !== "status"
        );

        if (unexpectedFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Unexpected fields: ${unexpectedFields.join(", ")}`
            });
        }

        if (Object.keys(body).length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required for update"
            });
        }

        const updateData = {};

        if (body.fullName !== undefined) {
            if (
                typeof body.fullName !== "string" ||
                !body.fullName.trim() ||
                body.fullName.trim().length > 120
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid customer name"
                });
            }

            updateData.fullName = body.fullName.trim();
        }

        if (body.phone !== undefined) {
            if (
                typeof body.phone !== "string" ||
                !isValidPhone(body.phone.trim())
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid phone number"
                });
            }

            updateData.phone = body.phone.trim();
        }

        if (body.email !== undefined) {
            if (
                body.email !== null &&
                body.email !== "" &&
                (
                    typeof body.email !== "string" ||
                    body.email.length > 254 ||
                    !isValidEmail(body.email.trim())
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email address"
                });
            }

            updateData.email = body.email
                ? body.email.trim()
                : null;
        }

        if (body.address !== undefined) {
            if (
                body.address !== null &&
                (
                    typeof body.address !== "string" ||
                    body.address.length > 500
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid address"
                });
            }

            updateData.address = body.address
                ? body.address.trim()
                : null;
        }

        if (body.status !== undefined) {
            if (
                !["NEW", "ASSIGNED", "CONTACTED", "CONVERTED", "CLOSED"]
                    .includes(body.status)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid customer status"
                });
            }

            updateData.status = body.status;
        }

        if (body.interestStatus !== undefined) {
            if (
                !["PENDING", "INTERESTED", "NOT_INTERESTED"]
                    .includes(body.interestStatus)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid interest status"
                });
            }

            updateData.interestStatus = body.interestStatus;
        }

        const customer = await customerService.updateCustomer(
            customerId,
            updateData
        );

        return res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            data: {
                customer
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 5. Get customer assignment
const getCustomerAssignment = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.customerId);

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const assignment = await customerService.getCustomerAssignment(
            customerId
        );

        return res.status(200).json({
            success: true,
            message: "Customer assignment fetched successfully",
            data: {
                assignment
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 6. Assign customer using customer ID in URL
const assignCustomer = async (req, res) => {
    try {
        const customerId = parseCustomerId(req.params.customerId);
        const insideSalesEmployeeId = Number(req.body.insideSalesEmployeeId);

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        if (
            !Number.isSafeInteger(insideSalesEmployeeId) ||
            insideSalesEmployeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid Inside Sales employee ID is required"
            });
        }

        const customer = await customerService.assignCustomer(
            customerId,
            insideSalesEmployeeId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Customer assigned successfully",
            data: {
                customer
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// 7. Assign customer using Executive /assignments endpoint
const assignCustomerFromBody = async (req, res) => {
    try {
        const { customerId, insideSalesEmployeeId } = req.body || {};

        const parsedCustomerId = parseCustomerId(customerId);
        const parsedEmployeeId = Number(insideSalesEmployeeId);

        if (!parsedCustomerId) {
            return res.status(400).json({
                success: false,
                message: "Valid customer ID is required"
            });
        }

        if (
            !Number.isSafeInteger(parsedEmployeeId) ||
            parsedEmployeeId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid Inside Sales employee ID is required"
            });
        }

        const customer = await customerService.assignCustomer(
            parsedCustomerId,
            parsedEmployeeId,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "Customer assigned successfully",
            data: {
                customer
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    getCustomerAssignment,
    assignCustomer,
    assignCustomerFromBody
};
