import LegacyDashboard from "./LegacyDashboard.jsx"
import AdminExecutiveWorkspace from "./AdminExecutiveWorkspace.jsx"
import InsideSalesWorkspace from "./InsideSalesWorkspace.jsx"
import OutsideSalesWorkspace from "./OutsideSalesWorkspace.jsx"
import { useAuth } from "../auth/AuthContext.jsx"

/**
 * Dashboard routes to the role-specific workspace based on the authenticated user's role.
 * Falls back to LegacyDashboard for any unrecognised role.
 */
export default function Dashboard() {
  const { user } = useAuth()

  if (user?.role === "ADMIN" || user?.role === "EXECUTIVE") {
    return <AdminExecutiveWorkspace />
  }

  if (user?.role === "INSIDE_SALES") {
    return <InsideSalesWorkspace />
  }

  if (user?.role === "OUTSIDE_SALES") {
    return <OutsideSalesWorkspace />
  }

  return <LegacyDashboard />
}
