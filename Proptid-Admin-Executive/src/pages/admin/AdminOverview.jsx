
import {
  Users,
  Contact,
  UserCheck,
  MapPin,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import StatCard from "../../components/common/StatCard"

export default function AdminOverview() {
  return (
    <div>
      <PageHeading
        title="Admin Overview"
        description="Monitor your real estate operations from one place."
      />

      <div className="stats-grid">
        <StatCard
          title="Total Employees"
          value="6"
          icon={Users}
          color="blue"
        />

        <StatCard
          title="Total Customers"
          value="6"
          icon={Contact}
          color="purple"
        />

        <StatCard
          title="Active Assignments"
          value="4"
          icon={UserCheck}
          color="green"
        />

        <StatCard
          title="Property Visits"
          value="2"
          icon={MapPin}
          color="orange"
        />
      </div>

      <div className="card">
        <h2>Welcome to Proptide Admin</h2>
        <p>
          Manage employees, customers, assignments, property visits,
          attendance and announcements from your admin workspace.
        </p>
      </div>
    </div>
  )
}
