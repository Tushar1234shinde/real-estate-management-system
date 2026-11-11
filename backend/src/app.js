import express from "express";
import cors from "cors";
import { getJwtConfig } from "./config/auth.js";
import { getCorsOptions } from "./config/cors.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorMiddleware.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createOutsideSalesRouter } from "./routes/outsideSalesRoutes.js";
import { createVisitScheduleRouter } from "./routes/visitScheduleRoutes.js";
import { createVisitRouter } from "./routes/visitRoutes.js";
import { createEvidenceRouter } from "./routes/evidenceRoutes.js";
import { createAdminVisitReviewRouter } from "./routes/adminVisitReviewRoutes.js";

export function createApp({ prismaClient, jwtConfig, corsOptions, loginRateLimiter, cloudinaryClient, environment } = {}) {
    const app = express();
    const resolvedJwtConfig = jwtConfig ?? getJwtConfig();
    const resolvedCorsOptions = corsOptions ?? getCorsOptions();

    app.use(cors(resolvedCorsOptions));
    app.use(express.json());

    app.get("/", (req, res) => {
        res.status(200).json({
            success: true,
            message: "Real Estate Management System API is running!",
        });
    });

    app.use("/api/auth", createAuthRouter({
        prismaClient,
        jwtConfig: resolvedJwtConfig,
        loginRateLimiter,
    }));
    app.use("/api/outside-sales", createOutsideSalesRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
    }));
    app.use("/api/visit-schedules", createVisitScheduleRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
    }));
    app.use("/api/visits", createVisitRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
    }));
    app.use("/api/visits", createEvidenceRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        cloudinaryClient,
        environment,
    }));
    app.use("/api/admin", createAdminVisitReviewRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
    }));

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
