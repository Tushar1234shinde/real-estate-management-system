import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { getJwtConfig } from "../config/auth.js";
import { AppError } from "../errors/AppError.js";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
// This fixed hash is not tied to any account. It keeps unknown-user requests on
// the same bcrypt code path as real credential checks.
const DUMMY_PASSWORD_HASH = "$2b$12$BdWntppJCaG2sz/DZOxzLuZ6H2dnKli.avQ2q2idjiMWIKAUuzdSi";

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

            const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
            if (!user || !user.isActive || !passwordMatches) {
                throw new AppError(401, INVALID_LOGIN_MESSAGE);
            }

            const token = jwt.sign({ sub: String(user.id) }, config.secret, {
                algorithm: "HS256",
                expiresIn: config.expiresIn,
                issuer: config.issuer,
                audience: config.audience,
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
