export const employeeRoles = [
  { value: "ADMIN", label: "Admin" },

  { value: "EXECUTIVE", label: "Executive" },

  { value: "INSIDE_SALES", label: "Inside Sales Employee" },

  { value: "OUTSIDE_SALES", label: "Outside Sales Employee" },
]

export const roleNames = {
  admin: "Admin",

  executive: "Executive",

  "inside-sales": "Inside Sales Employee",

  "outside-sales": "Outside Sales Employee",
}

export const routeRoleValues = {
  admin: "ADMIN",

  executive: "EXECUTIVE",

  "inside-sales": "INSIDE_SALES",

  "outside-sales": "OUTSIDE_SALES",
}

export const propertyOptions = [
  "Aurora Heights",

  "The Grove Residences",

  "Skyline One",

  "Marina Bay Homes",
]

const today = () => new Date().toISOString().slice(0, 10)

export function createInitialData() {
  return {
    employees: [
      {
        id: "emp-admin",

        name: "Arjun Sharma",

        email: "admin@proptide.com",

        phone: "9876543200",

        role: "ADMIN",

        status: "Active",

        employeeId: "PROP-0001",
      },

      {
        id: "emp-nina",

        name: "Nina Shah",

        email: "nina@example.com",

        phone: "9876543210",

        role: "INSIDE_SALES",

        status: "Active",

        employeeId: "PROP-0101",
      },

      {
        id: "emp-rohan",

        name: "Rohan Das",

        email: "rohan@example.com",

        phone: "9876543211",

        role: "OUTSIDE_SALES",

        status: "Active",

        employeeId: "PROP-0102",
      },

      {
        id: "emp-dev",

        name: "Dev Patil",

        email: "dev@example.com",

        phone: "9876543212",

        role: "EXECUTIVE",

        status: "Active",

        employeeId: "PROP-0103",
      },

      {
        id: "emp-sara",

        name: "Sara Roy",

        email: "sara@example.com",

        phone: "9876543213",

        role: "INSIDE_SALES",

        status: "Active",

        employeeId: "PROP-0104",
      },

      {
        id: "emp-kabir",

        name: "Aditi Singh",

        email: "aditi@example.com",

        phone: "9876543214",

        role: "OUTSIDE_SALES",

        status: "Active",

        employeeId: "PROP-0105",
      },
    ],

    customers: [
      {
        id: "cus-aarav",

        name: "Aarav Mehta",

        email: "aarav@example.com",

        phone: "9812344821",

        property: "Aurora Heights",

        status: "Interested",

        assignedInsideSalesId: "emp-nina",
      },

      {
        id: "cus-maya",

        name: "Maya Kapoor",

        email: "maya@example.com",

        phone: "9812300294",

        property: "The Grove Residences",

        status: "Interested",

        assignedInsideSalesId: "emp-nina",

        assignedOutsideSalesId: "emp-rohan",
      },

      {
        id: "cus-neil",

        name: "Neil Fernandes",

        email: "neil@example.com",

        phone: "9812377158",

        property: "Skyline One",

        status: "Contacted",

        assignedInsideSalesId: "emp-nina",
      },

      {
        id: "cus-isha",

        name: "Isha Bansal",

        email: "isha@example.com",

        phone: "9812333370",

        property: "Marina Bay Homes",

        status: "Not Interested",

        assignedInsideSalesId: "emp-nina",
      },

      {
        id: "cus-zoya",

        name: "Zoya Khan",

        email: "zoya@example.com",

        phone: "9812388612",

        property: "The Grove Residences",

        status: "New",

        assignedInsideSalesId: "emp-sara",
      },

      {
        id: "cus-kabir",

        name: "Kabir Joshi",

        email: "kabir.customer@example.com",

        phone: "9812311946",

        property: "Aurora Heights",

        status: "Interested",

        assignedInsideSalesId: "emp-sara",

        assignedOutsideSalesId: "emp-kabir",
      },
    ],

    visits: [
      {
        id: "visit-maya",

        customerId: "cus-maya",

        outsideSalesEmployeeId: "emp-rohan",

        date: today(),

        time: "14:00",

        status: "Scheduled",

        selfieName: "",

        notes: "",
      },

      {
        id: "visit-kabir",

        customerId: "cus-kabir",

        outsideSalesEmployeeId: "emp-kabir",

        date: today(),

        time: "10:30",

        status: "Completed",

        selfieName: "",

        notes: "Sample completed visit.",
      },
    ],
    calls: [],
    announcements: [
      {
        id: "announcement-holiday",

        title: "Office holiday notice",

        audience: "All employees",

        message:
          "The office will remain closed on Friday. Please coordinate customer follow-ups with your team lead.",

        createdAt: new Date().toISOString(),
      },
    ],
  }
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getInitials(name = "") {
  return name

    .trim()

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part[0] || "")

    .join("")

    .toUpperCase()
}

export function maskPhone(phone = "") {
  return `•••• ${phone.slice(-4)}`
}

export function getEmployeeById(employees, id) {
  return employees.find((employee) => employee.id === id)
}

export function getRoleLabel(role) {
  return employeeRoles.find((item) => item.value === role)?.label || role
}
