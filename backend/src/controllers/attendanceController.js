import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const EMPLOYEE_ROLES = new Set(["EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]);
const ATTENDANCE_STATUSES = new Set(["LOGGED_IN", "LOGGED_OUT", "AUTO_LOGGED_OUT"]);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const attendanceSelect = {
    id: true, employeeId: true, officeLocationId: true, loginTime: true, logoutTime: true,
    loginLatitude: true, loginLongitude: true, logoutLatitude: true, logoutLongitude: true,
    status: true, logoutReason: true,
    employee: { select: { id: true, fullName: true, email: true, role: { select: { name: true } } } },
    officeLocation: { select: { id: true, officeName: true, address: true } },
};

function requireObject(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Request body must be a JSON object.");
}

function rejectUnexpectedFields(body, allowed) {
    if (Object.keys(body).some((field) => !allowed.has(field))) throw new AppError(400, "Request body contains unsupported fields.");
}

function coordinate(value, name, minimum, maximum) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new AppError(400, `${name} must be a finite number between ${minimum} and ${maximum}.`);
    }
    return value;
}

function positiveInteger(value, name) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new AppError(400, `${name} must be a positive integer.`);
    return value;
}

function queryPositiveInteger(value, fallback, name, maximum) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AppError(400, `${name} must be a positive integer.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) throw new AppError(400, `${name} must be between 1 and ${maximum}.`);
    return parsed;
}

function dayBounds(value, name = "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(400, `${name} must use YYYY-MM-DD.`);
    const start = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) throw new AppError(400, `${name} must be a valid calendar date.`);
    return { start, end: new Date(start.getTime() + 86_400_000) };
}

function dateWhere(query) {
    if (query.date !== undefined && (query.from !== undefined || query.to !== undefined)) throw new AppError(400, "date cannot be combined with from or to.");
    if (query.date !== undefined) {
        const { start, end } = dayBounds(query.date);
        return { loginTime: { gte: start, lt: end } };
    }
    if (query.from === undefined && query.to === undefined) return {};
    const from = query.from === undefined ? undefined : dayBounds(query.from, "from").start;
    const to = query.to === undefined ? undefined : dayBounds(query.to, "to").end;
    if (from && to && from >= to) throw new AppError(400, "from must be on or before to.");
    return { loginTime: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } };
}

function workingDurationMinutes(attendance) {
    if (!attendance.logoutTime) return null;
    return Math.max(0, Math.floor((new Date(attendance.logoutTime) - new Date(attendance.loginTime)) / 60_000));
}

function present(attendance) {
    return { ...attendance, workingDurationMinutes: workingDurationMinutes(attendance) };
}

function isUniqueViolation(error) {
    return error?.code === "P2002" || error?.code === "23505";
}

export function createAttendanceController({ prismaClient = prisma, now = () => new Date() } = {}) {
    return {
        checkIn: async (req, res) => {
            requireObject(req.body);
            rejectUnexpectedFields(req.body, new Set(["latitude", "longitude", "officeLocationId"]));
            const latitude = coordinate(req.body.latitude, "latitude", -90, 90);
            const longitude = coordinate(req.body.longitude, "longitude", -180, 180);
            const officeLocationId = positiveInteger(req.body.officeLocationId, "officeLocationId");
            const office = await prismaClient.officeLocation.findFirst({ where: { id: officeLocationId, isActive: true }, select: { id: true } });
            if (!office) throw new AppError(422, "The selected office location is unavailable.");
            try {
                const attendance = await prismaClient.attendance.create({
                    data: { employeeId: req.user.id, officeLocationId: office.id, loginTime: now(), loginLatitude: latitude, loginLongitude: longitude },
                    select: attendanceSelect,
                });
                res.status(201).json({ success: true, data: { attendance: present(attendance) } });
            } catch (error) {
                if (isUniqueViolation(error)) throw new AppError(409, "You already have an active attendance record.");
                throw error;
            }
        },

        checkOut: async (req, res) => {
            requireObject(req.body);
            rejectUnexpectedFields(req.body, new Set(["latitude", "longitude"]));
            const latitude = coordinate(req.body.latitude, "latitude", -90, 90);
            const longitude = coordinate(req.body.longitude, "longitude", -180, 180);
            const checkoutTime = now();
            const active = await prismaClient.attendance.findFirst({
                where: { employeeId: req.user.id, status: "LOGGED_IN" }, select: { id: true }, orderBy: { loginTime: "desc" },
            });
            if (!active) throw new AppError(409, "No active attendance record is available for checkout.");
            const updated = await prismaClient.attendance.updateMany({
                where: { id: active.id, employeeId: req.user.id, status: "LOGGED_IN" },
                data: { logoutTime: checkoutTime, logoutLatitude: latitude, logoutLongitude: longitude, status: "LOGGED_OUT", logoutReason: "MANUAL" },
            });
            if (updated.count !== 1) throw new AppError(409, "Attendance has already been checked out.");
            const attendance = await prismaClient.attendance.findUnique({ where: { id: active.id }, select: attendanceSelect });
            res.status(200).json({ success: true, data: { attendance: present(attendance) } });
        },

        myAttendance: async (req, res) => {
            const page = queryPositiveInteger(req.query.page, 1, "page");
            const pageSize = queryPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const where = { employeeId: req.user.id, ...dateWhere(req.query) };
            const [attendance, total] = await prismaClient.$transaction([
                prismaClient.attendance.findMany({ where, select: attendanceSelect, orderBy: [{ loginTime: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
                prismaClient.attendance.count({ where }),
            ]);
            res.status(200).json({ success: true, data: { attendance: attendance.map(present), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
        },

        myAttendanceForDate: async (req, res) => {
            const { start, end } = dayBounds(req.params.date);
            const attendance = await prismaClient.attendance.findMany({ where: { employeeId: req.user.id, loginTime: { gte: start, lt: end } }, select: attendanceSelect, orderBy: [{ loginTime: "asc" }, { id: "asc" }] });
            res.status(200).json({ success: true, data: { date: req.params.date, attendance: attendance.map(present), status: attendance.some((item) => item.status === "LOGGED_IN") ? "LOGGED_IN" : attendance.length ? "LOGGED_OUT" : "NOT_CHECKED_IN" } });
        },

        listAttendance: async (req, res) => {
            const page = queryPositiveInteger(req.query.page, 1, "page");
            const pageSize = queryPositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE, "pageSize", MAX_PAGE_SIZE);
            const employeeId = req.query.employeeId === undefined ? undefined : queryPositiveInteger(req.query.employeeId, undefined, "employeeId");
            const status = req.query.status;
            if (status !== undefined && (!ATTENDANCE_STATUSES.has(status))) throw new AppError(400, "status must be a supported attendance status.");
            const where = { ...(employeeId ? { employeeId } : {}), ...(status ? { status } : {}), ...dateWhere(req.query) };
            const [attendance, total] = await prismaClient.$transaction([
                prismaClient.attendance.findMany({ where, select: attendanceSelect, orderBy: [{ loginTime: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
                prismaClient.attendance.count({ where }),
            ]);
            res.status(200).json({ success: true, data: { attendance: attendance.map(present), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } } });
        },

        summary: async (req, res) => {
            const { start, end } = dayBounds(req.query.date === undefined ? now().toISOString().slice(0, 10) : req.query.date);
            const where = { loginTime: { gte: start, lt: end } };
            const [attendance, employees] = await prismaClient.$transaction([
                prismaClient.attendance.findMany({ where, select: attendanceSelect, orderBy: { loginTime: "asc" } }),
                prismaClient.user.findMany({ where: { isActive: true, role: { name: { in: [...EMPLOYEE_ROLES] } } }, select: { id: true, fullName: true, email: true, role: { select: { name: true } } }, orderBy: [{ fullName: "asc" }, { id: "asc" }] }),
            ]);
            const checkedIn = new Set(attendance.map((item) => item.employeeId));
            const byStatus = Object.fromEntries([...ATTENDANCE_STATUSES].map((item) => [item, 0]));
            for (const item of attendance) byStatus[item.status] += 1;
            res.status(200).json({ success: true, data: {
                date: start.toISOString().slice(0, 10),
                summary: { totalEmployees: employees.length, checkedIn: checkedIn.size, notCheckedIn: employees.length - checkedIn.size, byStatus },
                notCheckedInEmployees: employees.filter((employee) => !checkedIn.has(employee.id)),
                attendance: attendance.map(present),
            } });
        },

        listActiveOfficeLocations: async (req, res) => {
            const offices = await prismaClient.officeLocation.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    officeName: true,
                    address: true,
                    latitude: true,
                    longitude: true,
                    allowedRadiusMeters: true,
                },
                orderBy: [{ officeName: "asc" }, { id: "asc" }],
            });
            res.status(200).json({ success: true, data: { officeLocations: offices } });
        },
    };
}
