
import { useMemo, useState } from "react"
import {
  Contact,
  Search,
  Plus,
  X,
  Pencil,
  Trash2,
  Filter,
  Users,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

const initialData = createInitialData()

const salesEmployees = initialData.employees.filter(
  (employee) =>
    employee.role === "INSIDE_SALES" ||
    employee.role === "OUTSIDE_SALES"
)

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  status: "New",
  insideSalesId: "",
  outsideSalesId: "",
}

const statuses = [
  "New",
  "Contacted",
  "Interested",
  "Not Interested",
]

export default function AdminCustomers() {
  const [customers, setCustomers] = useState(
    () => createInitialData().customers
  )

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)

  const getEmployeeName = (employeeId) => {
    const employee = salesEmployees.find(
      (item) => item.id === employeeId
    )

    return employee?.name || "Not assigned"
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchText = search.toLowerCase()

      const matchesSearch =
        (customer.name || "").toLowerCase().includes(searchText) ||
        (customer.email || "").toLowerCase().includes(searchText) ||
        (customer.phone || "").toLowerCase().includes(searchText)

      const matchesStatus =
        statusFilter === "All" ||
        customer.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [customers, search, statusFilter])

  function handleInputChange(event) {
    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function openAddModal() {
    setEditingId(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  function openEditModal(customer) {
    setEditingId(customer.id)

    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      status: customer.status || "New",
      insideSalesId: customer.insideSalesId || "",
      outsideSalesId: customer.outsideSalesId || "",
    })

    setShowModal(true)
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (editingId) {
      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === editingId
            ? { ...customer, ...formData }
            : customer
        )
      )
    } else {
      const newCustomer = {
        id: `customer-${Date.now()}`,
        ...formData,
      }

      setCustomers((previous) => [
        ...previous,
        newCustomer,
      ])
    }

    setShowModal(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  function handleDelete(customer) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${customer.name}?`
    )

    if (confirmed) {
      setCustomers((previous) =>
        previous.filter((item) => item.id !== customer.id)
      )
    }
  }

  const totalCustomers = customers.length

  const interestedCustomers = customers.filter(
    (customer) => customer.status === "Interested"
  ).length

  const newCustomers = customers.filter(
    (customer) => customer.status === "New"
  ).length

  const assignedCustomers = customers.filter(
    (customer) => customer.insideSalesId || customer.outsideSalesId
  ).length

  return (
    <div>
      <PageHeading
        title="Customer Management"
        description="View, manage and assign customers to your sales team."
        action={
          <button
            className="primary-button"
            onClick={openAddModal}
          >
            <Plus size={16} />
            Add Customer
          </button>
        }
      />

      {/* Customer Statistics */}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Customers</span>
            <div className="stat-icon blue">
              <Contact size={20} />
            </div>
          </div>
          <h2>{totalCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>New Customers</span>
            <div className="stat-icon purple">
              <Users size={20} />
            </div>
          </div>
          <h2>{newCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Interested Customers</span>
            <div className="stat-icon green">
              <Contact size={20} />
            </div>
          </div>
          <h2>{interestedCustomers}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Assigned Customers</span>
            <div className="stat-icon orange">
              <Users size={20} />
            </div>
          </div>
          <h2>{assignedCustomers}</h2>
        </div>
      </div>

      {/* Customer Table */}

      <div className="card">
        <div className="customer-toolbar">
          <div className="customer-title">
            <Contact size={20} />
            <strong>
              All Customers ({filteredCustomers.length})
            </strong>
          </div>

          <div className="customer-filters">
            <label className="employee-search">
              <Search size={17} />
              <input
                placeholder="Search customers..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label className="status-filter">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="All">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Inside Sales</th>
                <th>Outside Sales</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name}</strong>
                    </td>

                    <td>{customer.phone || "—"}</td>

                    <td>{customer.email || "—"}</td>

                    <td>
                      <span
                        className={`status-badge ${(
                          customer.status || "New"
                        ).toLowerCase().replaceAll(" ", "-")}`}
                      >
                        {customer.status || "New"}
                      </span>
                    </td>

                    <td>
                      {getEmployeeName(customer.insideSalesId)}
                    </td>

                    <td>
                      {getEmployeeName(customer.outsideSalesId)}
                    </td>

                    <td>
                      <div className="employee-actions">
                        <button
                          className="action-button edit"
                          title="Edit customer"
                          onClick={() => openEditModal(customer)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="action-button delete"
                          title="Delete customer"
                          onClick={() => handleDelete(customer)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-table">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}

      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal customer-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingId ? "Edit Customer" : "Add New Customer"}
                </h2>
                <p>Enter the customer information below.</p>
              </div>

              <button
                className="icon-button"
                type="button"
                onClick={() => setShowModal(false)}
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Customer Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter customer name"
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                />
              </label>

              <label>
                Phone Number
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Enter phone number"
                  required
                />
              </label>

              <label>
                Customer Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Assign Inside Sales Executive
                <select
                  name="insideSalesId"
                  value={formData.insideSalesId}
                  onChange={handleInputChange}
                >
                  <option value="">Not assigned</option>

                  {salesEmployees
                    .filter(
                      (employee) =>
                        employee.role === "INSIDE_SALES"
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Assign Outside Sales Executive
                <select
                  name="outsideSalesId"
                  value={formData.outsideSalesId}
                  onChange={handleInputChange}
                >
                  <option value="">Not assigned</option>

                  {salesEmployees
                    .filter(
                      (employee) =>
                        employee.role === "OUTSIDE_SALES"
                    )
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  {editingId ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
