import prisma from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const ROLE_VALUES = ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"];
const CUSTOMER_STATUS_VALUES = ["NEW", "ASSIGNED", "CONTACTED", "CONVERTED", "CLOSED"];
const CUSTOMER_INTEREST_STATUS_VALUES = ["PENDING", "INTERESTED", "NOT_INTERESTED"];
const PROPERTY_STATUS_VALUES = ["AVAILABLE", "BOOKED", "SOLD", "INACTIVE"];
const CALL_OUTCOME_VALUES = ["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"];
const VISIT_SCHEDULE_STATUS_VALUES = ["SCHEDULED", "RESCHEDULED", "CANCELLED", "COMPLETED"];
const VISIT_STATUS_VALUES = ["IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "REJECTED", "CANCELLED"];

function emptyCounts(values) {
    return Object.fromEntries(values.map((value) => [value, 0]));
}

function countRowsByEnum(values, rows, key) {
    const counts = emptyCounts(values);
    for (const row of rows) {
        counts[row[key]] = row._count._all;
    }
    return counts;
}

function sumCounts(counts) {
    return Object.values(counts).reduce((total, count) => total + count, 0);
}

function buildEmployeeCounts(roles, rows) {
    const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
    const byRoleAndStatus = Object.fromEntries(ROLE_VALUES.map((role) => [role, { active: 0, inactive: 0 }]));

    for (const row of rows) {
        const roleName = roleNameById.get(row.roleId);
        if (roleName && byRoleAndStatus[roleName]) {
            byRoleAndStatus[roleName][row.isActive ? "active" : "inactive"] = row._count._all;
        }
    }

    return {
        total: Object.values(byRoleAndStatus).reduce((total, counts) => total + counts.active + counts.inactive, 0),
        byRoleAndStatus,
    };
}

function safeProfile(user) {
    return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        role: user.role.name,
    };
}

export function createAdminDashboardController({ prismaClient = prisma } = {}) {
    return {
        dashboard: async (req, res) => {
            const [
                roles,
                employeeRows,
                customerStatusRows,
                customerInterestRows,
                assignedCustomers,
                unassignedCustomers,
                propertyRows,
                callRows,
                scheduleRows,
                visitRows,
            ] = await prismaClient.$transaction([
                prismaClient.role.findMany({ select: { id: true, name: true } }),
                prismaClient.user.groupBy({ by: ["roleId", "isActive"], _count: { _all: true } }),
                prismaClient.customer.groupBy({ by: ["status"], _count: { _all: true } }),
                prismaClient.customer.groupBy({ by: ["interestStatus"], _count: { _all: true } }),
                prismaClient.customer.count({ where: { assignment: { isNot: null } } }),
                prismaClient.customer.count({ where: { assignment: { is: null } } }),
                prismaClient.property.groupBy({ by: ["status"], _count: { _all: true } }),
                prismaClient.callLog.groupBy({ by: ["outcome"], _count: { _all: true } }),
                prismaClient.visitSchedule.groupBy({ by: ["status"], _count: { _all: true } }),
                prismaClient.visit.groupBy({ by: ["status"], _count: { _all: true } }),
            ]);

            const employees = buildEmployeeCounts(roles, employeeRows);
            const customerStatuses = countRowsByEnum(CUSTOMER_STATUS_VALUES, customerStatusRows, "status");
            const customerInterestStatuses = countRowsByEnum(CUSTOMER_INTEREST_STATUS_VALUES, customerInterestRows, "interestStatus");
            const properties = countRowsByEnum(PROPERTY_STATUS_VALUES, propertyRows, "status");
            const callOutcomes = countRowsByEnum(CALL_OUTCOME_VALUES, callRows, "outcome");
            const visitScheduleStatuses = countRowsByEnum(VISIT_SCHEDULE_STATUS_VALUES, scheduleRows, "status");
            const visitStatuses = countRowsByEnum(VISIT_STATUS_VALUES, visitRows, "status");

            res.status(200).json({
                success: true,
                data: {
                    employees,
                    customers: {
                        total: sumCounts(customerStatuses),
                        byStatus: customerStatuses,
                        byInterestStatus: customerInterestStatuses,
                        assigned: assignedCustomers,
                        unassigned: unassignedCustomers,
                    },
                    properties: { total: sumCounts(properties), byStatus: properties },
                    callLogs: { total: sumCounts(callOutcomes), byOutcome: callOutcomes },
                    visitSchedules: { total: sumCounts(visitScheduleStatuses), byStatus: visitScheduleStatuses },
                    visits: { total: sumCounts(visitStatuses), byStatus: visitStatuses },
                },
            });
        },

        profile: async (req, res) => {
            const user = await prismaClient.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    profileImageUrl: true,
                    isActive: true,
                    role: { select: { name: true } },
                },
            });
            if (!user || !user.isActive || !ROLE_VALUES.includes(user.role.name)) {
                throw new AppError(404, "Profile not found.");
            }
            res.status(200).json({ success: true, data: { profile: safeProfile(user) } });
        },
    };
}
