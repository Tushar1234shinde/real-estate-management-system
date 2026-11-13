
require("dotenv").config();

const prisma = require("../config/database");
const { hashPassword } = require("../utils/password");

// Temporary test accounts for Admin and Executive dashboard testing.
const test_users = [
    {
        fullName: "Demo Administrator",
        email: "admin@estateflow.demo",
        password: "demo123",
        role_name: "ADMIN",
        description: "System Administrator"
    },
    {
        fullName: "Demo Executive",
        email: "executive@estateflow.demo",
        password: "demo123",
        role_name: "EXECUTIVE",
        description: "Executive Dashboard User"
    }
];

// Main function runs the test-account creation process.
const main = async () => {
    try {

    // Ensure all employee roles exist in the database.
    // These roles are required when creating employees from the Admin Dashboard.
    const employee_roles = [
        {
            name: "INSIDE_SALES",
            description: "Inside Sales Employee"
        },
        {
            name: "OUTSIDE_SALES",
            description: "Outside Sales Employee"
        }
    ];

    for (const employee_role of employee_roles) {
        await prisma.role.upsert({
            where: {
                name: employee_role.name
            },
            update: {},
            create: {
                name: employee_role.name,
                description: employee_role.description
            }
        });
    }

    console.log("Employee roles are ready!");

        for (const test_user of test_users) {

            // Find the role or create it if it doesn't exist.
            const role = await prisma.role.upsert({
                where: {
                    name: test_user.role_name
                },
                update: {},
                create: {
                    name: test_user.role_name,
                    description: test_user.description
                }
            });

            // Avoid modifying an existing account.
            const existing_user = await prisma.user.findUnique({
                where: {
                    email: test_user.email
                }
            });

            if (existing_user) {
                console.log(`User already exists: ${test_user.email}`);
                continue;
            }

            // Hash the password before saving it.
            const password_hash = await hashPassword(test_user.password);

            // Create the test user.
            await prisma.user.create({
                data: {
                    fullName: test_user.fullName,
                    email: test_user.email,
                    passwordHash: password_hash,
                    roleId: role.id,
                    isActive: true
                }
            });

            console.log(`Created test user: ${test_user.email}`);
        }

        console.log("\nTest accounts are ready!");

    } catch (error) {
        console.error("Error creating test users:", error);
    } finally {
        await prisma.$disconnect();
    }
};

main();
