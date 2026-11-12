
import { useEffect, useMemo, useState } from "react"
import {
  Users,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  UserCheck,
  Filter,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData, getInitials } from "../../data/mockData"

const CUSTOMER_KEY = "proptide_executive_customers"
const EMPLOYEE_KEY = "proptide_employees"

const STATUSES = ["New", "Contacted", "Interested", "Not Interested"]

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  source: "",
  status: "New",
  insideSalesId: "",
  outsideSalesId: "",
  notes: "",
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function getInitialCustomers() {
  const fallback = createInitialData().customers || []
  const saved = readStorage(CUSTOMER_KEY, fallback)
  return Array.isArray(saved) ? saved : fallback
}

function getInitialEmployees() {
  const fallback = createInitialData().employees || []
  const saved = readStorage(EMPLOYEE_KEY, fallback)
  return Array.isArray(saved) ? saved : fallback
}

function makeId() {
  return `customer-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

function employeeName(employees, id) {
  if (!id) return "Not assigned"
  return employees.find((employee) => employee.id === id)?.name || "Not assigned"
}

function activeEmployees(employees, role) {
  return employees.filter((employee) => {
    const employeeRole = String(employee.role || "").toUpperCase()
    const status = String(employee.status || "ACTIVE").toUpperCase()

    return employeeRole === role && status !== "INACTIVE"
  })
}

function statusClass(status = "New") {
  return status.toLowerCase().replace(/\s+/g, "-")
}

export default function ExecutiveCustomers() {
  const [customers, setCustomers] = useState(getInitialCustomers)
  const [employees] = useState(getInitialEmployees)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")

  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [error, setError] = useState("")

  const insideSalesEmployees = useMemo(
    () => activeEmployees(employees, "INSIDE_SALES"),
    [employees]
  )

  const outsideSalesEmployees = useMemo(
    () => activeEmployees(employees, "OUTSIDE_SALES"),
    [employees]
  )

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customers))
    } catch {
      setError("Unable to save customer data in this browser.")
    }
  }, [customers])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        [
          customer.name,
          customer.email,
          customer.phone,
          customer.source,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        )

      const matchesStatus =
        statusFilter === "All" || customer.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [customers, search, statusFilter])

  const stats = [
    {
      title: "Total Customers",
      value: customers.length,
      icon: Users,
      color: "blue",
    },
    {
      title: "New Customers",
      value: customers.filter((item) => item.status === "New").length,
      icon: UserPlus,
      color: "purple",
    },
    {
      title: "Interested",
      value: customers.filter((item) => item.status === "Interested").length,
      icon: UserCheck,
      color: "green",
    },
    {
      title: "Contacted",
      value: customers.filter((item) => item.status === "Contacted").length,
      icon: Phone,
      color: "orange",
    },
  ]

  function openAddModal() {
    setEditingCustomer(null)
    setForm({ ...EMPTY_FORM })
    setError("")
    setShowModal(true)
  }

  function openEditModal(customer) {
    setEditingCustomer(customer)

    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      source: customer.source || "",
      status: customer.status || "New",
      insideSalesId:
        customer.insideSalesId ||
        customer.assignedInsideSalesId ||
        "",
      outsideSalesId:
        customer.outsideSalesId ||
        customer.assignedOutsideSalesId ||
        "",
      notes: customer.notes || "",
    })

    setError("")
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingCustomer(null)
    setForm({ ...EMPTY_FORM })
    setError("")
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setError("")
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError("")

    const name = form.name.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()

    if (!name || !phone) {
      setError("Customer name and phone number are required.")
      return
    }

    if (!/^[0-9+\-\s()]{7,16}$/.test(phone)) {
      setError("Please enter a valid phone number.")
      return
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.")
      return
    }

    const normalizedPhone = phone.replace(/\s/g, "")

    const duplicate = customers.some((customer) => {
      return (
        String(customer.phone || "").replace(/\s/g, "") === normalizedPhone &&
        customer.id !== editingCustomer?.id
      )
    })

    if (duplicate) {
      setError("This phone number already exists.")
      return
    }

    const now = new Date().toISOString()

    const customerData = {
      ...form,
      id: editingCustomer?.id || makeId(),
      name,
      phone,
      email,
      insideSalesId: form.insideSalesId,
      outsideSalesId: form.outsideSalesId,
      assignedInsideSalesId: form.insideSalesId,
      assignedOutsideSalesId: form.outsideSalesId,
      updatedAt: now,
    }

    if (editingCustomer) {
      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === editingCustomer.id
            ? { ...customer, ...customerData }
            : customer
        )
      )
    } else {
      setCustomers((previous) => [
        { ...customerData, createdAt: now },
        ...previous,
      ])
    }

    setSearch("")
    setStatusFilter("All")
    closeModal()
  }

  function handleDelete(customer) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${customer.name}?`
    )

    if (!confirmed) return

    setCustomers((previous) =>
      previous.filter((item) => item.id !== customer.id)
    )
  }

  return (
    <div className="executive-customers-page">
      <PageHeading
        title="Customer Management"
        description="Manage customer details, track interests and assign sales employees."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <UserPlus size={18} />
            Add Customer
          </button>
        }
      />

      {/* CUSTOMER STATISTICS */}
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon

          return (
            <div className="stat-card" key={stat.title}>
              <div className="stat-card-top">
                <span>{stat.title}</span>
                <div className={`stat-icon ${stat.color}`}>
                  <Icon size={20} />
                </div>
              </div>
              <h2>{stat.value}</h2>
              <p>Customers in workspace</p>
            </div>
          )
        })}
      </div>

      {/* SEARCH AND FILTER */}
      <div className="executive-employee-toolbar">
        <label className="employee-search">
          <Search size={18} />
          <input
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="executive-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* CUSTOMER TABLE */}
      <div className="card table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Inside Sales</th>
              <th>Outside Sales</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  No customers found.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="executive-employee-name">
                      <div className="avatar">
                        {getInitials(customer.name || "Customer")}
                      </div>
                      <div>
                        <strong>{customer.name || "Unnamed Customer"}</strong>
                        <small>{customer.source || "Source not specified"}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="executive-contact">
                      <span>
                        <Mail size={14} />
                        {customer.email || "—"}
                      </span>
                      <span>
                        <Phone size={14} />
                        {customer.phone || "—"}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className={`status-badge ${statusClass(customer.status)}`}>
                      {customer.status || "New"}
                    </span>
                  </td>

                  <td>
                    {employeeName(
                      employees,
                      customer.insideSalesId || customer.assignedInsideSalesId
                    )}
                  </td>

                  <td>
                    {employeeName(
                      employees,
                      customer.outsideSalesId || customer.assignedOutsideSalesId
                    )}
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        onClick={() => openEditModal(customer)}
                        aria-label="Edit customer"
                        title="Edit customer"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        onClick={() => handleDelete(customer)}
                        aria-label="Delete customer"
                        title="Delete customer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="employee-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {editingCustomer ? "Edit Customer" : "Add New Customer"}
                </h2>
                <p>Enter customer information and sales assignments.</p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="customer-form">
              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                />
              </div>

              <div className="form-group">
                <label>Lead Source</label>
                <select
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                >
                  <option value="">Select source</option>
                  <option value="Website">Website</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Referral">Referral</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Advertisement">Advertisement</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Customer Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  {STATUSES.map((status) => (
                    <option value={status} key={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Inside Sales Employee</label>
                <select
                  name="insideSalesId"
                  value={form.insideSalesId}
                  onChange={handleChange}
                >
                  <option value="">Not assigned</option>
                  {insideSalesEmployees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Outside Sales Employee</label>
                <select
                  name="outsideSalesId"
                  value={form.outsideSalesId}
                  onChange={handleChange}
                >
                  <option value="">Not assigned</option>
                  {outsideSalesEmployees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Add customer notes..."
                  rows="3"
                />
              </div>

              {error && (
                <div className="executive-form-error">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  {editingCustomer ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
