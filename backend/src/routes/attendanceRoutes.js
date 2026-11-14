import { Router } from "express";
import { createAttendanceController } from "../controllers/attendanceController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorizeRoles, createAuthenticate, ROLES } from "../middlewares/authMiddleware.js";

export function createAttendanceRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAttendanceController({ prismaClient });
    const authenticate = createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience });
    const employees = [authenticate, authorizeRoles(ROLES.EXECUTIVE, ROLES.INSIDE_SALES, ROLES.OUTSIDE_SALES)];
    router.post("/check-in", ...employees, asyncHandler(controller.checkIn));
    router.post("/check-out", ...employees, asyncHandler(controller.checkOut));
    router.get("/", ...employees, asyncHandler(controller.myAttendance));
    router.get("/date/:date", ...employees, asyncHandler(controller.myAttendanceForDate));
    router.get("/office-locations", ...employees, asyncHandler(controller.listActiveOfficeLocations));
    return router;
}

export function createAdminAttendanceRouter({ prismaClient, jwtSecret, jwtIssuer, jwtAudience } = {}) {
    const router = Router();
    const controller = createAttendanceController({ prismaClient });
    const protect = [createAuthenticate({ prismaClient, jwtSecret, jwtIssuer, jwtAudience }), authorizeRoles(ROLES.ADMIN)];
    router.get("/attendance", ...protect, asyncHandler(controller.listAttendance));
    router.get("/attendance/summary", ...protect, asyncHandler(controller.summary));
    return router;
}
