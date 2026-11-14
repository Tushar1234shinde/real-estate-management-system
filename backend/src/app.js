import express from "express";
import cors from "cors";
import helmet from "helmet";
import prisma from "./config/prisma.js";
import { validateProductionConfiguration } from "./config/production.js";
import { getJwtConfig } from "./config/auth.js";
import { getCorsOptions } from "./config/cors.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorMiddleware.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createOutsideSalesRouter } from "./routes/outsideSalesRoutes.js";
import { createVisitScheduleRouter } from "./routes/visitScheduleRoutes.js";
import { createVisitRouter } from "./routes/visitRoutes.js";
import { createEvidenceRouter } from "./routes/evidenceRoutes.js";
import { createAdminVisitReviewRouter } from "./routes/adminVisitReviewRoutes.js";
import { createInsideSalesRouter } from "./routes/insideSalesRoutes.js";
import { createAdminEmployeeRouter } from "./routes/adminEmployeeRoutes.js";
import { createAdminCustomerRouter } from "./routes/adminCustomerRoutes.js";
import { createAdminPropertyRouter } from "./routes/adminPropertyRoutes.js";
import { createAdminDashboardRouter } from "./routes/adminDashboardRoutes.js";
import { createExecutiveRouter } from "./routes/executiveRoutes.js";
import { createWhatsAppWebhookRouter } from "./routes/whatsAppWebhookRoutes.js";
import { createAdminAttendanceRouter, createAttendanceRouter } from "./routes/attendanceRoutes.js";
import { createAdminAnnouncementRouter, createAnnouncementRouter } from "./routes/announcementRoutes.js";
import { createAdminCallLogRouter } from "./routes/callLogRoutes.js";
import { createOfficeLocationRouter } from "./routes/officeLocationRoutes.js";

const JSON_BODY_LIMIT = "100kb";

export function createApp({
    prismaClient,
    jwtConfig,
    corsOptions,
    loginRateLimiter,
    cloudinaryClient,
    metaWhatsAppClient,
    environment,
} = {}) {
    const app = express();
    validateProductionConfiguration(environment ?? process.env);
    const readinessPrisma = prismaClient ?? prisma;
    const resolvedJwtConfig = jwtConfig ?? getJwtConfig();
    const resolvedCorsOptions = corsOptions ?? getCorsOptions();

    app.disable("x-powered-by");
    app.use(helmet({
        // This service exposes a JSON API rather than browser-rendered documents.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        // API responses are intentionally consumed by explicitly allowed CORS origins.
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }));
    app.use(cors(resolvedCorsOptions));
    app.use(
        "/api/webhooks/whatsapp",
        express.raw({ type: "application/json", limit: JSON_BODY_LIMIT, inflate: false }),
        createWhatsAppWebhookRouter({ prismaClient, environment }),
    );
    app.use(express.json({
        limit: JSON_BODY_LIMIT,
    }));

    app.get("/", (req, res) => {
        res.status(200).json({
            success: true,
            message: "Real Estate Management System API is running!",
        });
    });

    app.get("/health/live", (req, res) => {
        res.status(200).json({ success: true, status: "live" });
    });

    app.get("/health/ready", async (req, res) => {
        try {
            await readinessPrisma.$queryRaw`SELECT 1`;
            res.status(200).json({ success: true, status: "ready" });
        } catch {
            res.status(503).json({ success: false, status: "unavailable" });
        }
    });

    app.use("/api/auth", createAuthRouter({
        prismaClient,
        jwtConfig: resolvedJwtConfig,
        loginRateLimiter,
    }));
    app.use("/api/attendance", createAttendanceRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/announcements", createAnnouncementRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/outside-sales", createOutsideSalesRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        cloudinaryClient,
        environment,
    }));
    app.use("/api/inside-sales", createInsideSalesRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        cloudinaryClient,
        metaWhatsAppClient,
        environment,
    }));
    app.use("/api/executive", createExecutiveRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/visit-schedules", createVisitScheduleRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/visits", createVisitRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/visits", createEvidenceRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        cloudinaryClient,
        environment,
    }));
    app.use("/api/admin", createAdminVisitReviewRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        cloudinaryClient,
        environment,
    }));
    app.use("/api/admin", createAdminEmployeeRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/admin", createAdminCustomerRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        metaWhatsAppClient,
        environment,
    }));
    app.use("/api/admin", createAdminPropertyRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
        cloudinaryClient,
        environment,
    }));
    app.use("/api/admin", createAdminDashboardRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/admin", createAdminAttendanceRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/admin", createAdminAnnouncementRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/admin", createAdminCallLogRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use("/api/admin/office-locations", createOfficeLocationRouter({
        prismaClient,
        jwtSecret: resolvedJwtConfig.secret,
        jwtIssuer: resolvedJwtConfig.issuer,
        jwtAudience: resolvedJwtConfig.audience,
    }));
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
