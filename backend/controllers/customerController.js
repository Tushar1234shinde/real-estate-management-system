
import prisma from "../src/config/prisma.js";

// Add a new customer
export const addCustomer = async (req, res) => {
    try {
        const { fullName, email, phone, address } = req.body;

        // Validate required fields
        if (!fullName || !phone) {
            return res.status(400).json({
                success: false,
                message: "Customer name and phone number are required."
            });
        }

        // Create customer
        const customer = await prisma.customer.create({
            data: {
                fullName: fullName.trim(),
                email: email?.trim().toLowerCase() || null,
                phone: phone.trim(),
                address: address?.trim() || null
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                address: true,
                status: true,
                interestStatus: true,
                createdAt: true
            }
        });

        return res.status(201).json({
            success: true,
            message: "Customer added successfully.",
            customer
        });

    } catch (error) {
        console.error("Add customer error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};

// Get all customers
export const getAllCustomers = async (req, res) => {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                assignment: {
                    include: {
                        insideSalesEmployee: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            message: "Customers fetched successfully.",
            count: customers.length,
            customers
        });

    } catch (error) {
        console.error("Get customers error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


// Assign a customer to an Inside Sales employee
export const assignCustomer = async (req, res) => {
    try {
        const { customerId, insideSalesEmployeeId } = req.body;

        const customerIdNum = Number(customerId);
        const employeeIdNum = Number(insideSalesEmployeeId);

        if (
            !Number.isInteger(customerIdNum) || customerIdNum <= 0 ||
            !Number.isInteger(employeeIdNum) || employeeIdNum <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid customer ID and employee ID are required."
            });
        }

        // Check whether customer exists
        const customer = await prisma.customer.findUnique({
            where: { id: customerIdNum },
            include: { assignment: true }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found."
            });
        }

        if (customer.assignment) {
            return res.status(409).json({
                success: false,
                message: "Customer is already assigned."
            });
        }

        // Check whether employee exists and has the correct role
        const employee = await prisma.user.findUnique({
            where: { id: employeeIdNum },
            include: { role: true }
        });

        if (
            !employee ||
            !employee.isActive ||
            employee.role.name !== "INSIDE_SALES"
        ) {
            return res.status(400).json({
                success: false,
                message: "Please select an active Inside Sales employee."
            });
        }

        // Create assignment and update customer status
        const assignment = await prisma.$transaction(async (tx) => {
            const newAssignment = await tx.customerAssignment.create({
                data: {
                    customerId: customerIdNum,
                    insideSalesEmployeeId: employeeIdNum,
                    assignedByUserId: req.user.userId
                },
                include: {
                    customer: true,
                    insideSalesEmployee: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true
                        }
                    }
                }
            });

            await tx.customer.update({
                where: { id: customerIdNum },
                data: { status: "ASSIGNED" }
            });

            return newAssignment;
        });

        return res.status(201).json({
            success: true,
            message: "Customer assigned successfully.",
            assignment
        });

    } catch (error) {
        console.error("Assign customer error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Customer is already assigned."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};
