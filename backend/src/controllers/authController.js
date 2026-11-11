import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { getJwtConfig } from "../config/auth.js";
import { AppError } from "../errors/AppError.js";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeUser(user) {
    return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role.name,
    };
}

export function createAuthController({ prismaClient = prisma, jwtConfig } = {}) {
    const config = jwtConfig ?? getJwtConfig();

    return {
        login: async (req, res) => {
            const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
            const password = typeof req.body?.password === "string" ? req.body.password : "";

            if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL_LENGTH || !password || password.length > MAX_PASSWORD_LENGTH) {
                throw new AppError(400, "A valid email and password are required.");
            }

            const user = await prismaClient.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    passwordHash: true,
                    isActive: true,
                    role: {
                        select: { name: true },
                    },
                },
            });

            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                throw new AppError(401, "Invalid email or password.");
            }

            if (!user.isActive) {
                throw new AppError(403, "This user account is inactive.");
            }

            const token = jwt.sign({ sub: String(user.id) }, config.secret, {
                algorithm: "HS256",
                expiresIn: config.expiresIn,
            });

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: safeUser(user),
                },
            });
        },

        me: async (req, res) => {
            res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: req.user.id,
                        name: req.user.fullName,
                        email: req.user.email,
                        role: req.user.role,
                    },
                },
            });
        },
    };
}
