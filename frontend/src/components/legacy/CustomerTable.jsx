import React from "react"
import { MoreHorizontal } from "lucide-react"
import { StatusBadge } from "./StatusBadge.jsx"
import { EmptyState } from "./EmptyState.jsx"
import { getInitials, getEmployeeById, maskPhone } from "../../data/mockData.js"

export function CustomerTable({ rows, employees, onSelect, role }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Property interest</th>
            <th>Inside Sales owner</th>
            <th>Status</th>
            <th>Phone</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((customer) => {
            const owner = getEmployeeById(
              employees,
              customer.assignedInsideSalesId,
            )

            return (
              <tr key={customer.id} onClick={() => onSelect(customer)}>
                <td>
                  <div className="person-cell">
                    <div className="avatar soft">
                      {getInitials(customer.name)}
                    </div>
                    <div>
                      <strong>{customer.name}</strong>
                      <span>{customer.email || "No email provided"}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong className="table-main">{customer.property}</strong>
                </td>
                <td>{owner?.name || "Unassigned"}</td>
                <td>
                  <StatusBadge status={customer.status} />
                </td>
                <td>{maskPhone(customer.phone)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${customer.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(customer)
                    }}
                  >
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </div>
  )
}