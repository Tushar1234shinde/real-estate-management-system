
const adminService = require("./admin.service");

// Handles Admin Dashboard statistics requests.
const getDashboardStats = async (req, res) => {
    try {
        const result = await adminService.getDashboardStats();

        return res.status(200).json({
            success: true,
            message: "Dashboard statistics fetched successfully",
            data: result
        });

    } catch (error) {
        console.error("Admin Dashboard Statistics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard statistics"
        });
    }
};


// Handles requests to fetch employees with optional filters.
const getAllEmployees = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || "",
            role: req.query.role || "",
            status: req.query.status || ""
        };

        const employees = await adminService.getAllEmployees(
            filters,
            req.user.role
        );

        return res.status(200).json({
            success: true,
            message: "Employees fetched successfully",
            data: employees
        });

    } catch (error) {
        console.error("Employee List Error:", error);

        if (error.message === "Unauthorized employee operation") {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to view these employees"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employees"
        });
    }
};


// Handles requests to create a new employee.
const createEmployee = async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone,
            password,
            role_name
        } = req.body;

        if (!full_name || !email || !password || !role_name) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, password and position are required"
            });
        }

        const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email_pattern.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        if (!full_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Employee name cannot be empty"
            });
        }

        const employee = await adminService.createEmployee(
            {
                full_name: full_name.trim(),
                email: email.trim(),
                phone: phone ? phone.trim() : null,
                password,
                role_name
            },
            req.user.role
        );

        return res.status(201).json({
            success: true,
            message: "Employee created successfully",
            data: employee
        });

    } catch (error) {
        console.error("Create Employee Error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Email or phone number already exists"
            });
        }

        if (
            error.message === "Invalid employee position" ||
            error.message === "Selected employee role does not exist"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        if (error.message === "Unauthorized employee operation") {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to create this employee position"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create employee"
        });
    }
};


// Handles employee activation and deactivation requests.
const updateEmployeeStatus = async (req, res) => {
    try {
        const employee_id = Number(req.params.id);
        const { is_active } = req.body;

        if (!Number.isInteger(employee_id) || employee_id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID"
            });
        }

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false"
            });
        }

        const employee = await adminService.updateEmployeeStatus(
            employee_id,
            is_active,
            req.user.role
        );

        return res.status(200).json({
            success: true,
            message: is_active
                ? "Employee activated successfully"
                : "Employee deactivated successfully",
            data: employee
        });

    } catch (error) {
        if (error.message === "Employee not found") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (error.message === "Unauthorized employee operation") {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update this employee"
            });
        }

        console.error("Update Employee Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update employee status"
        });
    }
};

// Handles Admin daily attendance monitoring requests.
const getAttendance = async (req, res) => {
    try {
        const { date, search, role, status } = req.query;

        // Validate date format when supplied.
        if (date) {
            const valid_date =
                /^\d{4}-\d{2}-\d{2}$/.test(date) &&
                !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
                new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;

            if (!valid_date) {
                return res.status(400).json({
                    success: false,
                    message: "Date must be in YYYY-MM-DD format"
                });
            }
        }

        const allowed_statuses = [
            "ABSENT",
            "LOGGED_IN",
            "LOGGED_OUT",
            "AUTO_LOGGED_OUT"
        ];

        if (
            status &&
            !allowed_statuses.includes(status.toUpperCase())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid attendance status"
            });
        }

        const result = await adminService.getAttendance({
            date,
            search: search || "",
            role: role || "",
            status: status || ""
        });

        return res.status(200).json({
            success: true,
            message: "Attendance records fetched successfully",
            data: result
        });

    } catch (error) {
        console.error("Admin Attendance Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance records"
        });
    }
};

// Handles Admin call monitoring requests.
const getCalls = async (req, res) => {
    try {
        const calls = await adminService.getCalls();

        return res.status(200).json({
            success: true,
            message: "Call records fetched successfully",
            data: calls
        });

    } catch (error) {
        console.error("Admin Call Monitoring Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch call records"
        });
    }
};

// Handles Admin visit monitoring requests.
const getVisits = async (req, res) => {
    try {
        const visits = await adminService.getVisits();

        return res.status(200).json({
            success: true,
            message: "Visit records fetched successfully",
            data: visits
        });

    } catch (error) {
        console.error("Admin Visit Monitoring Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch visit records"
        });
    }
};

// Handles Admin WhatsApp message monitoring requests.
const getWhatsAppLogs = async (req, res) => {
    try {
        const messages = await adminService.getWhatsAppLogs();

        return res.status(200).json({
            success: true,
            message: "WhatsApp message logs fetched successfully",
            data: messages
        });

    } catch (error) {
        console.error("Admin WhatsApp Logs Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch WhatsApp message logs"
        });
    }
};

// Handles Admin property monitoring requests.
const getProperties = async (req, res) => {
    try {
        const properties = await adminService.getProperties();

        return res.status(200).json({
            success: true,
            message: "Property records fetched successfully",
            data: properties
        });

    } catch (error) {
        console.error("Admin Properties Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch property records"
        });
    }
};

module.exports = {
    getDashboardStats,
    getAllEmployees,
    createEmployee,
    updateEmployeeStatus,
    getAttendance,
    getCalls,
    getVisits,
    getWhatsAppLogs,
    getProperties
};
