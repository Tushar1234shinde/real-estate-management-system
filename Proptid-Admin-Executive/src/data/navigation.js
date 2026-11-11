
import {
  Home,
  Users,
  Contact,
  UserCheck,
  MapPin,
  Phone,
  FileAudio,
  Clock3,
  Megaphone,
  Settings,
  LogOut,
} from "lucide-react"

export const navByRole = {
  admin: [
    ["overview", "Overview", Home],
    ["employees", "Employee Management", Users],
    ["customers", "Customer Management", Contact],
    ["assignments", "Customer Assignments", UserCheck],
    ["visits", "Property Visits", MapPin],
    ["calls", "Call Records", Phone],
    ["media", "Media & Recordings", FileAudio],
    ["attendance", "Attendance", Clock3],
    ["announcements", "Announcements", Megaphone],
    ["settings", "Settings", Settings],
    ["signout", "Sign Out", LogOut],
  ],

  executive: [
    ["overview", "Overview", Home],
    ["employees", "Employee Management", Users],
    ["customers", "Customer Management", Contact],
    ["assignments", "Assign Customer", UserCheck],
    ["settings", "Settings", Settings],
    ["signout", "Sign Out", LogOut],
  ],
}

export const roleNames = {
  admin: "Admin",
  executive: "Executive",
}

export const routeRoleValues = {
  admin: "ADMIN",
  executive: "EXECUTIVE",
}
