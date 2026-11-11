
import prisma from "../src/config/prisma.js";
import bcrypt from "bcryptjs";

// Add a new employee
export const addEmployee = async (req, res) => {
    try {
        const { fullName, email, password, phone, role } = req.body;

        // Validate required fields
        if (!fullName || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, password and role are required."
            });
        }

        // Validate employee role
        const allowedRoles = ["EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee role."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check whether email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An employee with this email already exists."
            });
        }

        // Find the selected role
        const roleRecord = await prisma.role.findUnique({
            where: { name: role }
        });

        if (!roleRecord) {
            return res.status(400).json({
                success: false,
                message: "Selected role does not exist."
            });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create employee
        const employee = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email: normalizedEmail,
                passwordHash,
                phone: phone?.trim() || null,
                roleId: roleRecord.id
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: "Employee added successfully.",
            employee
        });

    } catch (error) {
        console.error("Add employee error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};

// Get all employees
export const getAllEmployees = async (req, res) => {
    try {
        const employees = await prisma.user.findMany({
            where: {
                role: {
                    name: {
                        in: ["EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]
                    }
                }
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                isActive: true,
                createdAt: true,
                role: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            message: "Employees fetched successfully.",
            count: employees.length,
            employees
        });

    } catch (error) {
        console.error("Get employees error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};
