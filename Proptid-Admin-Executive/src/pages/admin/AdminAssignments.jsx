
import { useMemo, useState } from "react"
import {
  UserCheck,
  Users,
  Search,
  Filter,
  ArrowRightLeft,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

export default function AdminAssignments() {
  const initialData = createInitialData()

  const [customers, setCustomers] = useState(initialData.customers)
  const [employees] = useState(initialData.employees)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  const salesEmployees = employees.filter((employee) =>
    ["INSIDE_SALES", "OUTSIDE_SALES"].includes(employee.role)
  )

  const insideSalesEmployees = salesEmployees.filter(
    (employee) => employee.role === "INSIDE_SALES"
  )

  const outsideSalesEmployees = salesEmployees.filter(
    (employee) => employee.role === "OUTSIDE_SALES"
  )

  // Support commonly used assignment field names.
  const getInsideId = (customer) =>
    customer.insideSalesId ||
    customer.assignedInsideSalesId ||
    ""

  const getOutsideId = (customer) =>
    customer.outsideSalesId ||
    customer.assignedOutsideSalesId ||
    ""

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(
      (item) => item.id === employeeId
    )

    return employee?.name || "Not assigned"
  }

  const isAssigned = (customer) =>
    Boolean(getInsideId(customer) || getOutsideId(customer))

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchText = search.toLowerCase()

      const matchesSearch =
        (customer.name || "").toLowerCase().includes(searchText) ||
        (customer.email || "").toLowerCase().includes(searchText) ||
        (customer.phone || "").toLowerCase().includes(searchText)

      const matchesFilter =
        filter === "all" ||
        (filter === "assigned" && isAssigned(customer)) ||
        (filter === "unassigned" && !isAssigned(customer))

      return matchesSearch && matchesFilter
    })
  }, [customers, search, filter])

  const updateAssignment = (customerId, field, employeeId) => {
    setCustomers((previousCustomers) =>
      previousCustomers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              [field]: employeeId,
            }
          : customer
      )
    )
  }

  const totalCustomers = customers.length
  const assignedCustomers = customers.filter(isAssigned).length
  const unassignedCustomers = totalCustomers - assignedCustomers

  return (
    <div>
      <PageHeading
        title="Customer Assignments"
        description="Assign inside-sales and outside-sales employees to customers."
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Customers</span>
            <div className="stat-icon blue">
              <Users size={20} />
            </div>
          </div>
          <h2>{totalCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Assigned Customers</span>
            <div className="stat-icon green">
              <UserCheck size={20} />
            </div>
          </div>
          <h2>{assignedCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Unassigned Customers</span>
            <div className="stat-icon orange">
              <Users size={20} />
            </div>
          </div>
          <h2>{unassignedCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Sales Employees</span>
            <div className="stat-icon purple">
              <ArrowRightLeft size={20} />
            </div>
          </div>
          <h2>{salesEmployees.length}</h2>
        </div>
      </div>

      <div className="card assignment-card">
        <div className="assignment-toolbar">
          <div>
            <h2>Manage Assignments</h2>
            <p>Choose employees for each customer.</p>
          </div>

          <div className="assignment-filters">
            <label className="employee-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search customers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <label className="assignment-filter">
              <Filter size={16} />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All Customers</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Inside Sales Employee</th>
                <th>Outside Sales Employee</th>
                <th>Assignment Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="assignment-customer">
                      <strong>{customer.name}</strong>
                      <small>{customer.phone || customer.email || customer.id}</small>
                    </div>
                  </td>

                  <td>
                    <select
                      className="assignment-select"
                      value={getInsideId(customer)}
                      onChange={(event) =>
                        updateAssignment(
                          customer.id,
                          "insideSalesId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">Not assigned</option>

                      {insideSalesEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      className="assignment-select"
                      value={getOutsideId(customer)}
                      onChange={(event) =>
                        updateAssignment(
                          customer.id,
                          "outsideSalesId",
                          event.target.value
                        )
                      }
                    >
                      <option value="">Not assigned</option>

                      {outsideSalesEmployees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${
                        isAssigned(customer) ? "active" : "inactive"
                      }`}
                    >
                      {isAssigned(customer) ? "Assigned" : "Unassigned"}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="assignment-note">
          <strong>Note:</strong> Assignments are currently stored in local
          page state for demonstration. They will reset when the page is
          refreshed. Backend integration will be added later.
        </div>
      </div>
    </div>
  )
}
