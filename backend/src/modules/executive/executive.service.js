
const prisma = require("../../config/database");

// Fetches statistics required by the Executive Dashboard.
const getExecutiveDashboardStats = async () => {

    const [
        total_employees,
        active_employees,
        inside_sales_employees,
        outside_sales_employees,
        total_customers,
        assigned_customers,
        unassigned_customers
    ] = await Promise.all([

        // Counts only Inside Sales and Outside Sales employees.
        prisma.user.count({
            where: {
                role: {
                    is: {
                        name: {
                            in: ["INSIDE_SALES", "OUTSIDE_SALES"]
                        }
                    }
                }
            }
        }),

        // Counts only active Inside Sales and Outside Sales employees.
        prisma.user.count({
            where: {
                isActive: true,
                role: {
                    is: {
                        name: {
                            in: ["INSIDE_SALES", "OUTSIDE_SALES"]
                        }
                    }
                }
            }
        }),

        // Counts all Inside Sales employees.
        prisma.user.count({
            where: {
                role: {
                    is: {
                        name: "INSIDE_SALES"
                    }
                }
            }
        }),

        // Counts all Outside Sales employees.
        prisma.user.count({
            where: {
                role: {
                    is: {
                        name: "OUTSIDE_SALES"
                    }
                }
            }
        }),

        // Counts all customers.
        prisma.customer.count(),

        // Counts customers having an assignment.
        prisma.customer.count({
            where: {
                assignment: {
                    isNot: null
                }
            }
        }),

        // Counts customers without an assignment.
        prisma.customer.count({
            where: {
                assignment: null
            }
        })
    ]);

    return {
        total_employees,
        active_employees,
        inside_sales_employees,
        outside_sales_employees,
        total_customers,
        assigned_customers,
        unassigned_customers
    };
};

module.exports = {
    getExecutiveDashboardStats
};
