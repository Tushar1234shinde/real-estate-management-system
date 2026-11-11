import { Router } from "express";
import { createAuthController } from "../controllers/authController.js";
import { createAuthenticate } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { createLoginRateLimiter } from "../middlewares/loginRateLimitMiddleware.js";

export function createAuthRouter({ prismaClient, jwtConfig, loginRateLimiter } = {}) {
    const router = Router();
    const controller = createAuthController({ prismaClient, jwtConfig });
    const authenticate = createAuthenticate({
        prismaClient,
        jwtSecret: jwtConfig?.secret,
        jwtIssuer: jwtConfig?.issuer,
        jwtAudience: jwtConfig?.audience,
    });

    router.post("/login", loginRateLimiter ?? createLoginRateLimiter(), asyncHandler(controller.login));
    router.get("/me", authenticate, asyncHandler(controller.me));

    return router;
}
