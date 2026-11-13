const prisma = require("../../config/database");
const { comparePassword } = require("../../utils/password");
const generateToken = require("../../utils/generateToken");

const login = async (email, password) => {

    // Find user in PostgreSQL
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            role: true
        }
    });

    if (!user) {
        throw new Error("Invalid email or password");
    }

    // Check account status
    if (user.isActive === false) {
        throw new Error("Your account is inactive");
    }

    // Verify password
    const is_password_valid = await comparePassword(
        password,
        user.passwordHash
    );

    if (!is_password_valid) {
        throw new Error("Invalid email or password");
    }

    // Read role from the related Roles table
    const role_name = user.role.name.toUpperCase();

    // Only Admin and Executive can access this dashboard
    if (!["ADMIN", "EXECUTIVE"].includes(role_name)) {
        throw new Error("You are not authorized to access this dashboard");
    }

    // Generate JWT
    const token = generateToken({
        id: user.id,
        role: role_name
    });

    return {
        token,
        user: {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: role_name
        }
    };
};


module.exports = { login };