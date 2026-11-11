import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { getJwtConfig } from "../config/auth.js";
import { AppError } from "../errors/AppError.js";

export const ROLES = Object.freeze({
    ADMIN: "ADMIN",
    EXECUTIVE: "EXECUTIVE",
    INSIDE_SALES: "INSIDE_SALES",
    OUTSIDE_SALES: "OUTSIDE_SALES",
});

function authenticationError(message) {
    return new AppError(401, message);
}

export function createAuthenticate({ prismaClient = prisma, jwtSecret } = {}) {
    const secret = jwtSecret ?? getJwtConfig().secret;

    return async (req, res, next) => {
        try {
            const authorization = req.headers.authorization;

            if (!authorization?.startsWith("Bearer ")) {
                throw authenticationError("Authentication token is required.");
            }

            const token = authorization.slice("Bearer ".length).trim();

            if (!token) {
                throw authenticationError("Authentication token is required.");
            }

            const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
            const userId = Number(payload.sub);

            if (!Number.isInteger(userId) || userId <= 0) {
                throw authenticationError("Authentication token is invalid.");
            }

            const user = await prismaClient.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    isActive: true,
                    role: {
                        select: { name: true },
                    },
                },
            });

            if (!user || !user.isActive) {
                throw authenticationError("Authentication is no longer valid.");
            }

            req.user = {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role.name,
            };

            return next();
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return next(authenticationError("Authentication token has expired."));
            }

            if (error.name === "JsonWebTokenError") {
                return next(authenticationError("Authentication token is invalid."));
            }

            return next(error);
        }
    };
}

export function authorizeRoles(...allowedRoles) {
    const invalidRole = allowedRoles.find((role) => !Object.values(ROLES).includes(role));

    if (invalidRole) {
        throw new Error(`Unsupported role configured for authorization: ${invalidRole}`);
    }

    return (req, res, next) => {
        if (!req.user) {
            return next(authenticationError("Authentication token is required."));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError(403, "You do not have permission to perform this action."));
        }

        return next();
    };
}
