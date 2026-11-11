import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";

const BCRYPT_SALT_ROUNDS = 12;

const roles = [
    { name: "ADMIN", description: "Administrator" },
    { name: "EXECUTIVE", description: "Executive" },
    { name: "INSIDE_SALES", description: "Inside Sales Employee" },
    { name: "OUTSIDE_SALES", description: "Outside Sales Employee" },
];

function requiredTrimmedEnvironmentVariable(name) {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(`${name} must be set before running the seed.`);
    }

    return value;
}

function requiredPassword() {
    const password = process.env.ADMIN_PASSWORD;

    if (!password || password.trim().length === 0) {
        throw new Error("ADMIN_PASSWORD must be set before running the seed.");
    }

    return password;
}

async function seed() {
    const adminName = requiredTrimmedEnvironmentVariable("ADMIN_NAME");
    const adminEmail = requiredTrimmedEnvironmentVariable("ADMIN_EMAIL");
    const adminPassword = requiredPassword();
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

    const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: {
            id: true,
            role: {
                select: { name: true },
            },
        },
    });

    if (existingUser && existingUser.role.name !== "ADMIN") {
        throw new Error(
            "ADMIN_EMAIL already belongs to a user without the ADMIN role. No changes were made.",
        );
    }

    const seededRoles = await prisma.$transaction(
        roles.map((role) =>
            prisma.role.upsert({
                where: { name: role.name },
                update: {},
                create: role,
            }),
        ),
    );

    const adminRole = seededRoles.find((role) => role.name === "ADMIN");

    if (!adminRole) {
        throw new Error("The ADMIN role could not be created or found.");
    }

    if (existingUser) {
        console.log("Initial Admin account already exists; no user changes were made.");
        return;
    }

    await prisma.user.create({
        data: {
            fullName: adminName,
            email: adminEmail,
            passwordHash,
            roleId: adminRole.id,
            isActive: true,
        },
    });

    console.log("System roles and initial Admin account were ensured.");
}

seed()
    .catch((error) => {
        console.error(`Database seed failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
