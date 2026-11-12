
import { useEffect, useMemo, useState } from "react"
import {
  Search,
  Users,
  UserCheck,
  UserPlus,
  ClipboardList,
  Save,
  RotateCcw,
} from "lucide-react"

import { createInitialData } from "../../data/mockData"

const CUSTOMER_KEY = "proptide_executive_customers"
const EMPLOYEE_KEY = "proptide_employees"

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function getCustomers() {
  const fallback = createInitialData().customers || []
  const saved = readStorage(CUSTOMER_KEY, fallback)
  return Array.isArray(saved) ? saved : fallback
}

function getEmployees() {
  const fallback = createInitialData().employees || []
  const saved = readStorage(EMPLOYEE_KEY, fallback)
  return Array.isArray(saved) ? saved : fallback
}

export default function ExecutiveAssignments() {
  const [customers, setCustomers] = useState(getCustomers)
  const [employees] = useState(getEmployees)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")
  const [message, setMessage] = useState("")

  const [draftAssignments, setDraftAssignments] = useState({})

  const insideSales = employees.filter(
    (employee) =>
      String(employee.role || "").toUpperCase() === "INSIDE_SALES" &&
      String(employee.status || "ACTIVE").toUpperCase() !== "INACTIVE"
  )

  const outsideSales = employees.filter(
    (employee) =>
      String(employee.role || "").toUpperCase() === "OUTSIDE_SALES" &&
      String(employee.status || "ACTIVE").toUpperCase() !== "INACTIVE"
  )

  useEffect(() => {
    const initialDrafts = {}

    customers.forEach((customer) => {
      initialDrafts[customer.id] = {
        insideSalesId:
          customer.insideSalesId ||
          customer.assignedInsideSalesId ||
          "",
        outsideSalesId:
          customer.outsideSalesId ||
          customer.assignedOutsideSalesId ||
          "",
      }
    })

    setDraftAssignments(initialDrafts)
  }, [customers])

  const assignedCount = customers.filter((customer) => {
    const inside =
      customer.insideSalesId || customer.assignedInsideSalesId
    const outside =
      customer.outsideSalesId || customer.assignedOutsideSalesId

    return inside || outside
  }).length

  const unassignedCount = customers.length - assignedCount

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchValue = search.toLowerCase().trim()

      const matchesSearch =
        !searchValue ||
        (customer.name || "").toLowerCase().includes(searchValue) ||
        (customer.phone || "").toLowerCase().includes(searchValue) ||
        (customer.email || "").toLowerCase().includes(searchValue)

      const draft = draftAssignments[customer.id] || {}

      const hasInside = Boolean(draft.insideSalesId)
      const hasOutside = Boolean(draft.outsideSalesId)

      let matchesFilter = true

      if (filter === "Assigned") {
        matchesFilter = hasInside || hasOutside
      } else if (filter === "Unassigned") {
        matchesFilter = !hasInside && !hasOutside
      } else if (filter === "Inside Sales") {
        matchesFilter = hasInside
      } else if (filter === "Outside Sales") {
        matchesFilter = hasOutside
      }

      return matchesSearch && matchesFilter
    })
  }, [customers, search, filter, draftAssignments])

  function updateAssignment(customerId, field, value) {
    setDraftAssignments((previous) => ({
      ...previous,
      [customerId]: {
        ...(previous[customerId] || {}),
        [field]: value,
      },
    }))

    setMessage("")
  }

  function saveAssignment(customerId) {
    const draft = draftAssignments[customerId] || {}

    const updatedCustomers = customers.map((customer) => {
      if (customer.id !== customerId) return customer

      return {
        ...customer,
        insideSalesId: draft.insideSalesId || "",
        outsideSalesId: draft.outsideSalesId || "",
        assignedInsideSalesId: draft.insideSalesId || "",
        assignedOutsideSalesId: draft.outsideSalesId || "",
      }
    })

    setCustomers(updatedCustomers)

    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify(updatedCustomers)
    )

    setMessage("Customer assignment saved successfully.")

    setTimeout(() => setMessage(""), 3000)
  }

  function resetAssignment(customer) {
    setDraftAssignments((previous) => ({
      ...previous,
      [customer.id]: {
        insideSalesId:
          customer.insideSalesId ||
          customer.assignedInsideSalesId ||
          "",
        outsideSalesId:
          customer.outsideSalesId ||
          customer.assignedOutsideSalesId ||
          "",
      },
    }))
  }

  function employeeName(id) {
    return employees.find((employee) => employee.id === id)?.name ||
      "Not assigned"
  }

  return (
    <div className="ea-page">
      <style>{`
        .ea-page {
          width: 100%;
          color: #1c2b43;
          font-family: inherit;
        }

        .ea-heading {
          margin-bottom: 26px;
        }

        .ea-heading h1 {
          font-size: 27px;
          margin: 0 0 8px;
        }

        .ea-heading p {
          font-size: 14px;
          color: #8491a5;
          margin: 0;
        }

        .ea-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 25px;
        }

        .ea-stat {
          background: #fff;
          border: 1px solid #e8edf4;
          border-radius: 13px;
          padding: 21px;
        }

        .ea-stat-icon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          margin-bottom: 15px;
        }

        .ea-stat-icon.blue {
          background: #edf3ff;
          color: #2864df;
        }

        .ea-stat-icon.green {
          background: #eaf8ef;
          color: #159957;
        }

        .ea-stat-icon.orange {
          background: #fff3e8;
          color: #e58a31;
        }

        .ea-stat p {
          color: #8390a4;
          font-size: 13px;
          margin: 0 0 8px;
        }

        .ea-stat h2 {
          font-size: 26px;
          margin: 0;
        }

        .ea-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
        }

        .ea-search {
          height: 44px;
          max-width: 420px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
          border: 1px solid #e1e7f0;
          border-radius: 9px;
          background: white;
          color: #8794a8;
        }

        .ea-search input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 13px;
          background: transparent;
          color: #26364d;
        }

        .ea-toolbar select {
          padding: 12px;
          border: 1px solid #e1e7f0;
          border-radius: 9px;
          background: white;
          color: #354258;
          outline: none;
          font-size: 13px;
        }

        .ea-table-card {
          background: white;
          border: 1px solid #e8edf4;
          border-radius: 13px;
          overflow: hidden;
        }

        .ea-table-title {
          padding: 21px;
          border-bottom: 1px solid #edf0f5;
        }

        .ea-table-title h3 {
          margin: 0 0 5px;
          font-size: 17px;
        }

        .ea-table-title p {
          margin: 0;
          color: #8794a8;
          font-size: 12px;
        }

        .ea-table-scroll {
          overflow-x: auto;
        }

        .ea-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
        }

        .ea-table th {
          background: #f8faff;
          color: #8390a4;
          font-size: 12px;
          padding: 15px;
          white-space: nowrap;
        }

        .ea-table td {
          padding: 15px;
          border-top: 1px solid #edf0f5;
          font-size: 12px;
          color: #44536a;
          vertical-align: middle;
        }

        .ea-customer-name {
          font-weight: 600;
          color: #26364d;
          font-size: 13px;
          margin-bottom: 5px;
        }

        .ea-customer-phone {
          color: #8794a8;
        }

        .ea-assignment-select {
          width: 175px;
          max-width: 100%;
          padding: 10px;
          border: 1px solid #dce3ed;
          border-radius: 8px;
          background: white;
          color: #354258;
          outline: none;
          font-size: 12px;
        }

        .ea-assignment-select:focus {
          border-color: #2864df;
        }

        .ea-save {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 13px;
          border: none;
          border-radius: 8px;
          background: #2864df;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .ea-save:hover {
          background: #1e50bd;
        }

        .ea-reset {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          margin-left: 7px;
          border: 1px solid #dce3ed;
          border-radius: 8px;
          background: white;
          color: #60718b;
          cursor: pointer;
        }

        .ea-message {
          padding: 12px 15px;
          margin-bottom: 17px;
          border-radius: 8px;
          background: #eaf8ef;
          color: #168d51;
          font-size: 13px;
        }

        .ea-empty {
          padding: 40px !important;
          text-align: center;
          color: #8794a8 !important;
        }

        @media (max-width: 850px) {
          .ea-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .ea-heading h1 {
            font-size: 22px;
          }

          .ea-stats {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .ea-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .ea-search {
            max-width: none;
          }
        }
      `}</style>

      <div className="ea-heading">
        <h1>Customer Assignments</h1>
        <p>
          Assign customers to Inside Sales and Outside Sales employees.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="ea-stats">
        <div className="ea-stat">
          <div className="ea-stat-icon blue">
            <Users size={21} />
          </div>
          <p>Total Customers</p>
          <h2>{customers.length}</h2>
        </div>

        <div className="ea-stat">
          <div className="ea-stat-icon green">
            <UserCheck size={21} />
          </div>
          <p>Assigned Customers</p>
          <h2>{assignedCount}</h2>
        </div>

        <div className="ea-stat">
          <div className="ea-stat-icon orange">
            <ClipboardList size={21} />
          </div>
          <p>Unassigned Customers</p>
          <h2>{unassignedCount}</h2>
        </div>
      </div>

      {message && (
        <div className="ea-message">{message}</div>
      )}

      {/* Search and Filter */}
      <div className="ea-toolbar">
        <div className="ea-search">
          <Search size={18} />
          <input
            placeholder="Search customer name or phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="All">All Customers</option>
          <option value="Assigned">Assigned Customers</option>
          <option value="Unassigned">Unassigned Customers</option>
          <option value="Inside Sales">Inside Sales Assigned</option>
          <option value="Outside Sales">Outside Sales Assigned</option>
        </select>
      </div>

      {/* Assignment Table */}
      <div className="ea-table-card">
        <div className="ea-table-title">
          <h3>Assign Customers</h3>
          <p>{filteredCustomers.length} customers displayed</p>
        </div>

        <div className="ea-table-scroll">
          <table className="ea-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Current Inside Sales</th>
                <th>Assign Inside Sales</th>
                <th>Assign Outside Sales</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length ? (
                filteredCustomers.map((customer) => {
                  const draft =
                    draftAssignments[customer.id] || {
                      insideSalesId: "",
                      outsideSalesId: "",
                    }

                  return (
                    <tr key={customer.id}>
                      <td>
                        <div className="ea-customer-name">
                          {customer.name}
                        </div>
                        <div className="ea-customer-phone">
                          {customer.phone || "No phone"}
                        </div>
                      </td>

                      <td>
                        {employeeName(
                          customer.insideSalesId ||
                          customer.assignedInsideSalesId
                        )}
                      </td>

                      <td>
                        <select
                          className="ea-assignment-select"
                          value={draft.insideSalesId || ""}
                          onChange={(event) =>
                            updateAssignment(
                              customer.id,
                              "insideSalesId",
                              event.target.value
                            )
                          }
                        >
                          <option value="">Not assigned</option>

                          {insideSales.map((employee) => (
                            <option
                              key={employee.id}
                              value={employee.id}
                            >
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          className="ea-assignment-select"
                          value={draft.outsideSalesId || ""}
                          onChange={(event) =>
                            updateAssignment(
                              customer.id,
                              "outsideSalesId",
                              event.target.value
                            )
                          }
                        >
                          <option value="">Not assigned</option>

                          {outsideSales.map((employee) => (
                            <option
                              key={employee.id}
                              value={employee.id}
                            >
                              {employee.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <button
                          className="ea-save"
                          onClick={() => saveAssignment(customer.id)}
                        >
                          <Save size={14} />
                          Save
                        </button>

                        <button
                          className="ea-reset"
                          title="Reset changes"
                          onClick={() => resetAssignment(customer)}
                        >
                          <RotateCcw size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="5" className="ea-empty">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
