import React from "react"
import { X, Check } from "lucide-react"
import { StatusBadge } from "./StatusBadge.jsx"
import { EmptyState } from "./EmptyState.jsx"
import { getInitials, getRoleLabel, maskPhone } from "../../data/mockData.js"

export function EmployeeTable({ rows, onSelect, onEdit, onToggleStatus, canManage }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((employee) => (
            <tr key={employee.id} onClick={() => onSelect(employee)}>
              <td>
                <div className="person-cell">
                  <div className="avatar soft">
                    {getInitials(employee.name)}
                  </div>
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.employeeId || "Employee ID not set"}</span>
                  </div>
                </div>
              </td>
              <td>{getRoleLabel(employee.role)}</td>
              <td>{employee.email}</td>
              <td>{maskPhone(employee.phone)}</td>
              <td>
                <StatusBadge status={employee.status} />
              </td>
              <td className="row-actions">
                {canManage && (
                  <>
                    <button
                      className="secondary-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit(employee)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button"
                      aria-label={
                        employee.status === "Active"
                          ? `Deactivate ${employee.name}`
                          : `Activate ${employee.name}`
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleStatus(employee)
                      }}
                    >
                      {employee.status === "Active" ? <X /> : <Check />}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </div>
  )
}