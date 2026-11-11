
import {
  Contact,
  UserCheck,
  Phone,
  CalendarCheck,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import StatCard from "../../components/common/StatCard"

export default function ExecutiveOverview() {
  return (
    <div>
      <PageHeading
        title="Executive Overview"
        description="Manage your customers and track your daily activities."
      />

      <div className="stats-grid">
        <StatCard
          title="Total Customers"
          value="6"
          icon={Contact}
          color="blue"
        />

        <StatCard
          title="Assigned Customers"
          value="4"
          icon={UserCheck}
          color="purple"
        />

        <StatCard
          title="Calls Completed"
          value="0"
          icon={Phone}
          color="green"
        />

        <StatCard
          title="Upcoming Visits"
          value="1"
          icon={CalendarCheck}
          color="orange"
        />
      </div>

      <div className="card">
        <h2>Welcome to your Executive Workspace</h2>
        <p>
          View your customers, manage assignments, update customer
          information and coordinate your property visits.
        </p>
      </div>
    </div>
  )
}
