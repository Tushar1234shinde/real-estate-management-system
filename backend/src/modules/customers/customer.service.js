
const prisma = require("../../config/database");

const CUSTOMER_STATUSES = [
    "NEW",
    "ASSIGNED",
    "CONTACTED",
    "CONVERTED",
    "CLOSED"
];

const INTEREST_STATUSES = [
    "PENDING",
    "INTERESTED",
    "NOT_INTERESTED"
];

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Common customer fields returned by the service
const customerSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    address: true,
    status: true,
    interestStatus: true,
    createdAt: true,
    updatedAt: true,
    assignment: {
        select: {
            id: true,
            insideSalesEmployeeId: true,
            assignedAt: true,
            status: true
        }
    }
};

// 1. Get all customers with filters and pagination
const getAllCustomers = async (filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);

    const pageSize = Math.min(
        Math.max(Number(filters.pageSize) || 20, 1),
        100
    );

    const where = {};

    if (filters.status) {
        if (!CUSTOMER_STATUSES.includes(filters.status)) {
            throw createError("Invalid customer status", 400);
        }

        where.status = filters.status;
    }

    if (filters.interestStatus) {
        if (!INTEREST_STATUSES.includes(filters.interestStatus)) {
            throw createError("Invalid interest status", 400);
        }

        where.interestStatus = filters.interestStatus;
    }

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            select: customerSelect,
            orderBy: [
                { createdAt: "desc" },
                { id: "asc" }
            ],
            skip: (page - 1) * pageSize,
            take: pageSize
        }),

        prisma.customer.count({ where })
    ]);

    return {
        customers,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
        }
    };
};

// 2. Create a customer
const createCustomer = async (customerData) => {
    const customer = await prisma.customer.create({
        data: {
            fullName: customerData.fullName,
            phone: customerData.phone,
            email: customerData.email || null,
            address: customerData.address || null,
            status: "NEW",
            interestStatus: customerData.interestStatus || "PENDING"
        },
        select: customerSelect
    });

    return customer;
};

// 3. Get customer by ID
const getCustomerById = async (customerId) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId
        },
        select: customerSelect
    });

    if (!customer) {
        throw createError("Customer not found", 404);
    }

    return customer;
};

// 4. Update customer
const updateCustomer = async (customerId, updateData) => {
    const existingCustomer = await prisma.customer.findUnique({
        where: {
            id: customerId
        },
        select: {
            id: true,
            status: true,
            assignment: {
                select: {
                    id: true
                }
            }
        }
    });

    if (!existingCustomer) {
        throw createError("Customer not found", 404);
    }

    if (updateData.status) {
        if (!CUSTOMER_STATUSES.includes(updateData.status)) {
            throw createError("Invalid customer status", 400);
        }

        const isAssigned = Boolean(existingCustomer.assignment);

        if (isAssigned && updateData.status === "NEW") {
            throw createError(
                "An assigned customer cannot be moved back to NEW",
                400
            );
        }

        if (!isAssigned && updateData.status !== "NEW") {
            throw createError(
                "A customer must be assigned before changing this status",
                400
            );
        }
    }

    if (
        updateData.interestStatus &&
        !INTEREST_STATUSES.includes(updateData.interestStatus)
    ) {
        throw createError("Invalid interest status", 400);
    }

    const customer = await prisma.customer.update({
        where: {
            id: customerId
        },
        data: updateData,
        select: customerSelect
    });

    return customer;
};

// 5. Get customer assignment
const getCustomerAssignment = async (customerId) => {
    const customer = await prisma.customer.findUnique({
        where: {
            id: customerId
        },
        select: {
            id: true,
            assignment: {
                include: {
                    insideSalesEmployee: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            isActive: true
                        }
                    },
                    assignedBy: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true
                        }
                    }
                }
            }
        }
    });

    if (!customer) {
        throw createError("Customer not found", 404);
    }

    return customer.assignment;
};

// 6. Assign customer to an Inside Sales employee
const assignCustomer = async (
    customerId,
    insideSalesEmployeeId,
    assignedByUserId
) => {
    try {
        return await prisma.$transaction(
            async (tx) => {
                const customer = await tx.customer.findUnique({
                    where: {
                        id: customerId
                    },
                    select: {
                        id: true,
                        assignment: {
                            select: {
                                id: true
                            }
                        }
                    }
                });

                if (!customer) {
                    throw createError("Customer not found", 404);
                }

                if (customer.assignment) {
                    throw createError(
                        "Customer is already assigned",
                        409
                    );
                }

                const employee = await tx.user.findFirst({
                    where: {
                        id: insideSalesEmployeeId,
                        isActive: true,
                        role: {
                            name: "INSIDE_SALES"
                        }
                    },
                    select: {
                        id: true
                    }
                });

                if (!employee) {
                    throw createError(
                        "Active Inside Sales employee not found",
                        404
                    );
                }

                await tx.customerAssignment.create({
                    data: {
                        customerId,
                        insideSalesEmployeeId,
                        assignedByUserId,
                        status: "ASSIGNED"
                    }
                });

                await tx.customer.update({
                    where: {
                        id: customerId
                    },
                    data: {
                        status: "ASSIGNED"
                    }
                });

                return tx.customer.findUnique({
                    where: {
                        id: customerId
                    },
                    select: customerSelect
                });
            },
            {
                isolationLevel: "Serializable"
            }
        );
    } catch (error) {
        if (
            error.code === "P2002" ||
            error.code === "P2034" ||
            error.code === "40001" ||
            error.code === "40P01"
        ) {
            throw createError(
                "Customer assignment conflict. Please try again.",
                409
            );
        }

        throw error;
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    getCustomerAssignment,
    assignCustomer
};
