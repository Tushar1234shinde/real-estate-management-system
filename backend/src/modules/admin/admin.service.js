
const prisma = require("../../config/database");
const { hashPassword } = require("../../utils/password");


// Returns employee positions accessible to the requesting user.
const getAllowedEmployeeRoles = (requester_role) => {

    if (requester_role === "ADMIN") {
        return [
            "EXECUTIVE",
            "INSIDE_SALES",
            "OUTSIDE_SALES"
        ];
    }

    if (requester_role === "EXECUTIVE") {
        return [
            "INSIDE_SALES",
            "OUTSIDE_SALES"
        ];
    }

    throw new Error("Unauthorized employee operation");
};


// Fetches statistics required by the Admin Dashboard.
const getDashboardStats = async () => {

    const [
        total_employees,
        total_customers,
        total_properties,
        active_employees,
        assigned_customers,
        completed_visits
    ] = await Promise.all([

        prisma.user.count({
            where: {
                role: {
                    is: {
                        name: {
                            in: ["EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]
                        }
                    }
                }
            }
        }),

        prisma.customer.count(),

        prisma.property.count(),

        prisma.user.count({
            where: {
                isActive: true,
                role: {
                    is: {
                        name: {
                            in: ["EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]
                        }
                    }
                }
            }
        }),

        prisma.customerAssignment.count(),

        prisma.visit.count({
            where: {
                status: "COMPLETED"
            }
        })
    ]);

    return {
        total_employees,
        total_customers,
        total_properties,
        active_employees,
        assigned_customers,
        completed_visits
    };
};


// Fetches employees with role-based access and optional filters.
const getAllEmployees = async (filters = {}, requester_role) => {

    const { search, role, status } = filters;

    const allowed_roles = getAllowedEmployeeRoles(requester_role);

    const conditions = [
        {
            role: {
                is: {
                    name: {
                        in: allowed_roles
                    }
                }
            }
        }
    ];

    // Search by employee name, email or phone.
    if (search && search.trim()) {

        const search_term = search.trim();

        conditions.push({
            OR: [
                {
                    fullName: {
                        contains: search_term,
                        mode: "insensitive"
                    }
                },
                {
                    email: {
                        contains: search_term,
                        mode: "insensitive"
                    }
                },
                {
                    phone: {
                        contains: search_term
                    }
                }
            ]
        });
    }

    // Apply role filter.
    if (role && role.trim()) {

        const requested_role = role.trim().toUpperCase();

        if (allowed_roles.includes(requested_role)) {
            conditions.push({
                role: {
                    is: {
                        name: requested_role
                    }
                }
            });
        } else {
            conditions.push({
                id: -1
            });
        }
    }

    // Apply employee status filter.
    if (status === "active") {
        conditions.push({
            isActive: true
        });
    } else if (status === "inactive") {
        conditions.push({
            isActive: false
        });
    }

    const employees = await prisma.user.findMany({

        where: {
            AND: conditions
        },

        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,

            role: {
                select: {
                    name: true
                }
            }
        },

        orderBy: {
            createdAt: "desc"
        }
    });

    return employees;
};


// Creates an employee account with role-based permissions.
const createEmployee = async (employee_data, requester_role) => {

    const {
        full_name,
        email,
        phone,
        password,
        role_name
    } = employee_data;

    const allowed_roles = getAllowedEmployeeRoles(requester_role);

    if (!allowed_roles.includes(role_name)) {

        if (requester_role === "EXECUTIVE") {
            throw new Error("Unauthorized employee operation");
        }

        throw new Error("Invalid employee position");
    }

    const employee_role = await prisma.role.findUnique({
        where: {
            name: role_name
        }
    });

    if (!employee_role) {
        throw new Error("Selected employee role does not exist");
    }

    const password_hash = await hashPassword(password);

    const employee = await prisma.user.create({

        data: {
            fullName: full_name,
            email: email.toLowerCase(),
            phone: phone || null,
            passwordHash: password_hash,
            roleId: employee_role.id
        },

        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,

            role: {
                select: {
                    name: true
                }
            }
        }
    });

    return employee;
};


// Activates or deactivates an employee within the caller's permissions.
const updateEmployeeStatus = async (
    employee_id,
    is_active,
    requester_role
) => {

    const allowed_roles = getAllowedEmployeeRoles(requester_role);

    const employee = await prisma.user.findFirst({
        where: {
            id: employee_id,
            role: {
                is: {
                    name: {
                        in: allowed_roles
                    }
                }
            }
        }
    });

    if (!employee) {
        throw new Error("Employee not found");
    }

    const updated_employee = await prisma.user.update({

        where: {
            id: employee_id
        },

        data: {
            isActive: is_active
        },

        select: {
            id: true,
            fullName: true,
            email: true,
            isActive: true,

            role: {
                select: {
                    name: true
                }
            }
        }
    });

    return updated_employee;
};

// Fetches daily attendance for Admin monitoring.
const getAttendance = async (filters = {}) => {
    const {
        date,
        search = "",
        role = "",
        status = ""
    } = filters;

    // EstateFlow attendance date uses India Standard Time.
    const attendance_date = date ||
        new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata"
        }).format(new Date());

    const start_of_day = new Date(
        `${attendance_date}T00:00:00.000+05:30`
    );

    const end_of_day = new Date(
        `${attendance_date}T00:00:00.000+05:30`
    );

    end_of_day.setUTCDate(end_of_day.getUTCDate() + 1);

    const allowed_roles = getAllowedEmployeeRoles("ADMIN");

    const conditions = [
        {
            role: {
                is: {
                    name: {
                        in: allowed_roles
                    }
                }
            }
        }
    ];

    // Search employees by name, email or phone.
    if (search && search.trim()) {
        const search_term = search.trim();

        conditions.push({
            OR: [
                {
                    fullName: {
                        contains: search_term,
                        mode: "insensitive"
                    }
                },
                {
                    email: {
                        contains: search_term,
                        mode: "insensitive"
                    }
                },
                {
                    phone: {
                        contains: search_term
                    }
                }
            ]
        });
    }

    // Filter by employee role.
    if (role && role.trim()) {
        const requested_role = role.trim().toUpperCase();

        conditions.push({
            role: {
                is: {
                    name: allowed_roles.includes(requested_role)
                        ? requested_role
                        : "__INVALID_ROLE__"
                }
            }
        });
    }

    const employees = await prisma.user.findMany({
        where: {
            AND: conditions
        },

        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,

            role: {
                select: {
                    name: true
                }
            },

            attendance: {
                where: {
                    loginTime: {
                        gte: start_of_day,
                        lt: end_of_day
                    }
                },

                orderBy: {
                    loginTime: "asc"
                },

                select: {
                    id: true,
                    loginTime: true,
                    logoutTime: true,
                    loginLatitude: true,
                    loginLongitude: true,
                    logoutLatitude: true,
                    logoutLongitude: true,
                    status: true,
                    logoutReason: true,

                    officeLocation: {
                        select: {
                            id: true,
                            officeName: true,
                            address: true
                        }
                    }
                }
            }
        },

        orderBy: {
            fullName: "asc"
        }
    });

    const attendance_data = employees.map((employee) => {
        const records = employee.attendance;

        let attendance_status = "ABSENT";

        if (records.length > 0) {
            if (records.some((record) => record.status === "LOGGED_IN")) {
                attendance_status = "LOGGED_IN";
            } else if (
                records.some((record) => record.status === "AUTO_LOGGED_OUT")
            ) {
                attendance_status = "AUTO_LOGGED_OUT";
            } else {
                attendance_status = "LOGGED_OUT";
            }
        }

        return {
            employee_id: employee.id,
            employee_name: employee.fullName,
            email: employee.email,
            phone: employee.phone,
            is_active: employee.isActive,
            role: employee.role.name,
            attendance_status,
            attendance_records: records.map((record) => ({
                attendance_id: record.id,
                check_in: record.loginTime,
                check_out: record.logoutTime,
                login_latitude: record.loginLatitude,
                login_longitude: record.loginLongitude,
                logout_latitude: record.logoutLatitude,
                logout_longitude: record.logoutLongitude,
                status: record.status,
                logout_reason: record.logoutReason,
                office: record.officeLocation
            }))
        };
    });

    // Filter by the derived attendance status.
    const filtered_attendance = status
        ? attendance_data.filter(
            (employee) =>
                employee.attendance_status === status.toUpperCase()
        )
        : attendance_data;

    return {
        date: attendance_date,
        total_employees: filtered_attendance.length,
        present_count: filtered_attendance.filter(
            (employee) => employee.attendance_status !== "ABSENT"
        ).length,
        absent_count: filtered_attendance.filter(
            (employee) => employee.attendance_status === "ABSENT"
        ).length,
        logged_in_count: filtered_attendance.filter(
            (employee) => employee.attendance_status === "LOGGED_IN"
        ).length,
        attendance: filtered_attendance
    };
};

// Fetch call records for Admin monitoring (read-only).
const getCalls = async () => {
    const calls = await prisma.callLog.findMany({
        include: {
            employee: {
                select: {
                    id: true,
                    fullName: true,
                    role: {
                        select: {
                            name: true
                        }
                    }
                }
            },
            customer: {
                select: {
                    id: true,
                    fullName: true,
                    phone: true
                }
            },
            property: {
                select: {
                    id: true,
                    title: true
                }
            }
        },
        orderBy: {
            calledAt: "desc"
        }
    });

    return calls;
};

// Fetch visit schedules and actual visit details for Admin monitoring.
const getVisits = async () => {
    const visits = await prisma.visitSchedule.findMany({
        include: {
            customer: {
                select: {
                    id: true,
                    fullName: true,
                    phone: true
                }
            },

            property: {
                select: {
                    id: true,
                    title: true,
                    location: true
                }
            },

            insideSalesEmployee: {
                select: {
                    id: true,
                    fullName: true
                }
            },

            outsideSalesEmployee: {
                select: {
                    id: true,
                    fullName: true
                }
            },

            scheduledBy: {
                select: {
                    id: true,
                    fullName: true
                }
            },

            visit: {
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            fullName: true
                        }
                    },

                    mediaAssets: {
                        select: {
                            id: true,
                            mediaType: true,
                            fileUrl: true,
                            uploadedAt: true,
                            uploadedBy: {
                                select: {
                                    id: true,
                                    fullName: true
                                }
                            }
                        }
                    },

                    statusHistory: {
                        include: {
                            changedByUser: {
                                select: {
                                    id: true,
                                    fullName: true
                                }
                            }
                        },
                        orderBy: {
                            changedAt: "desc"
                        }
                    }
                }
            }
        },

        orderBy: {
            scheduledAt: "desc"
        }
    });

    return visits;
};

// Fetch WhatsApp message logs for Admin monitoring.
const getWhatsAppLogs = async () => {
    const messages = await prisma.whatsAppMessageLog.findMany({
        include: {
            customer: {
                select: {
                    id: true,
                    fullName: true,
                    phone: true
                }
            },

            triggeredBy: {
                select: {
                    id: true,
                    fullName: true
                }
            },

            attachments: {
                select: {
                    id: true,
                    propertyDocumentId: true
                }
            }
        },

        orderBy: {
            createdAt: "desc"
        }
    });

    return messages;
};

// Fetch properties and their documents for Admin monitoring.
const getProperties = async () => {
    const properties = await prisma.property.findMany({
        include: {
            documents: {
                include: {
                    uploadedBy: {
                        select: {
                            id: true,
                            fullName: true
                        }
                    }
                },
                orderBy: {
                    uploadedAt: "desc"
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return properties;
};

module.exports = {
    getDashboardStats,
    getAllEmployees,
    createEmployee,
    updateEmployeeStatus,
    getAttendance,
    getCalls,
    getVisits,
    getWhatsAppLogs,
    getProperties
};
