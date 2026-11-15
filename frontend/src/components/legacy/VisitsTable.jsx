import React from "react"
import { MapPin, CheckCircle2 } from "lucide-react"
import { StatusBadge } from "./StatusBadge.jsx"
import { EmptyState } from "./EmptyState.jsx"
import { getEmployeeById } from "../../data/mockData.js"
import { CardHeading } from "./CardHeading.jsx"

export function VisitsTable({
  visits,
  data,
  role,
  employee,
  previews = {},
  onMarkReached,
  onCompleteVisit,
  onNavigateVisits,
}) {
  return (
    <section className="card data-page-card">
      {onNavigateVisits && (
        <div className="table-card-heading">
          <CardHeading
            title="Assigned visits"
            subtitle="Only visits assigned to this Outside Sales employee."
            action="Visit history"
            onAction={onNavigateVisits}
          />
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Property</th>
              <th>Outside Sales employee</th>
              <th>Date & time</th>
              <th>Visit status</th>
              <th>Selfie</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => {
              const customer = data.customers.find(
                (item) => item.id === visit.customerId,
              )

              const outsideEmployee = getEmployeeById(
                data.employees,
                visit.outsideSalesEmployeeId,
              )

              const canUpdate =
                role === "outside-sales" &&
                employee?.id === visit.outsideSalesEmployeeId

              return (
                <tr key={visit.id}>
                  <td>{customer?.name || "Customer removed"}</td>
                  <td>{customer?.property || "—"}</td>
                  <td>{outsideEmployee?.name || "Unassigned"}</td>
                  <td>
                    {visit.date} · {visit.time}
                  </td>
                  <td>
                    <StatusBadge status={visit.status} />
                  </td>
                  <td>
                    {previews[visit.id] ? (
                      <img
                        className="selfie-preview"
                        src={previews[visit.id]}
                        alt={`Visit selfie for ${customer?.name || "customer"}`}
                      />
                    ) : (
                      visit.selfieName || "—"
                    )}
                  </td>
                  <td>
                    {canUpdate && visit.status === "Scheduled" && (
                      <button
                        className="primary-button"
                        onClick={() => onMarkReached(visit.id)}
                      >
                        <MapPin /> Reached location
                      </button>
                    )}
                    {canUpdate && visit.status === "Reached Location" && (
                      <button
                        className="success-button"
                        onClick={() => onCompleteVisit(visit.id)}
                      >
                        <CheckCircle2 /> Complete visit
                      </button>
                    )}
                    {visit.status === "Completed" && <span>Completed</span>}
                    {!canUpdate && visit.status !== "Completed" && (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visits.length && (
          <EmptyState
            title="No visits scheduled"
            text="A visit will appear here after an interested customer is scheduled."
          />
        )}
      </div>
    </section>
  )
}