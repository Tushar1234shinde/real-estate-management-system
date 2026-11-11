
import { useMemo, useState } from "react"
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Phone,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData, createId, getInitials } from "../../data/mockData"

const STORAGE_KEY = "proptide_employees"

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "INSIDE_SALES",
  status: "Active",
}

function getEmployees() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (saved) return JSON.parse(saved)
  } catch (error) {
    console.error("Unable to read employees:", error)
  }

  return createInitialData().employees
}

export default function ExecutiveEmployees() {
  const [employees, setEmployees] = useState(getEmployees)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState("")

  const saveEmployees = (updatedEmployees) => {
    setEmployees(updatedEmployees)

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedEmployees)
      )
    } catch (storageError) {
      console.error("Unable to save employees:", storageError)
      setError("Unable to save employee data in this browser.")
    }
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const searchableText = [
        employee.name,
        employee.email,
        employee.phone,
        employee.id,
      ].join(" ").toLowerCase()

      const matchesSearch = searchableText.includes(
        search.toLowerCase()
      )

      const matchesRole =
        roleFilter === "All" || employee.role === roleFilter

      const matchesStatus =
        statusFilter === "All" ||
        (employee.status || "Active") === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [employees, search, roleFilter, statusFilter])

  const activeCount = employees.filter(
    (employee) => (employee.status || "Active") === "Active"
  ).length

  const inactiveCount = employees.length - activeCount

  const salesCount = employees.filter((employee) =>
    ["INSIDE_SALES", "OUTSIDE_SALES"].includes(employee.role)
  ).length

  const getRoleLabel = (role) => {
    const labels = {
      ADMIN: "Admin",
      EXECUTIVE: "Executive",
      INSIDE_SALES: "Inside Sales",
      OUTSIDE_SALES: "Outside Sales",
    }

    return labels[role] || role || "Not assigned"
  }

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setShowModal(true)
  }

  const openEditModal = (employee) => {
    setEditingId(employee.id)

    setForm({
      name: employee.name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      role: employee.role || "INSIDE_SALES",
      status: employee.status || "Active",
    })

    setError("")
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
    setError("")
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setError("")
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (
      employees.some(
        (employee) =>
          (employee.email || "").toLowerCase() ===
            form.email.trim().toLowerCase() &&
          employee.id !== editingId
      )
    ) {
      setError("An employee with this email already exists.")
      return
    }

    if (
      employees.some(
        (employee) =>
          employee.phone === form.phone.trim() &&
          employee.id !== editingId
      )
    ) {
      setError("An employee with this phone number already exists.")
      return
    }

    let updatedEmployees

    if (editingId) {
      updatedEmployees = employees.map((employee) =>
        employee.id === editingId
          ? {
              ...employee,
              ...form,
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
            }
          : employee
      )
    } else {
      const newEmployee = {
        id: createId(),
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      }

      updatedEmployees = [newEmployee, ...employees]
    }

    saveEmployees(updatedEmployees)
    closeModal()
  }

  const deleteEmployee = (employee) => {
    const confirmed = window.confirm(
      `Delete employee ${employee.name}?`
    )

    if (!confirmed) return

    const updatedEmployees = employees.filter(
      (item) => item.id !== employee.id
    )

    saveEmployees(updatedEmployees)
  }

  return (
    <div>
      <PageHeading
        title="Employee Management"
        description="View, add and manage employees in your workspace."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <UserPlus size={18} />
            Add Employee
          </button>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Employees</span>
            <div className="stat-icon blue">
              <Users size={20} />
            </div>
          </div>
          <h2>{employees.length}</h2>
          <p>Employees in workspace</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Active Employees</span>
            <div className="stat-icon green">
              <Users size={20} />
            </div>
          </div>
          <h2>{activeCount}</h2>
          <p>Currently active</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Inactive Employees</span>
            <div className="stat-icon orange">
              <Users size={20} />
            </div>
          </div>
          <h2>{inactiveCount}</h2>
          <p>Currently inactive</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Sales Employees</span>
            <div className="stat-icon purple">
              <Users size={20} />
            </div>
          </div>
          <h2>{salesCount}</h2>
          <p>Inside and outside sales</p>
        </div>
      </div>

      <div className="executive-employee-toolbar">
        <label className="employee-search">
          <Search size={18} />
          <input
            placeholder="Search by name, email, phone or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="executive-filter"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="All">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="EXECUTIVE">Executive</option>
          <option value="INSIDE_SALES">Inside Sales</option>
          <option value="OUTSIDE_SALES">Outside Sales</option>
        </select>

        <select
          className="executive-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="card table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table">
                  No employees found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="executive-employee-name">
                      <div className="avatar">
                        {getInitials(employee.name || "Employee")}
                      </div>
                      <strong>{employee.name || "Unnamed Employee"}</strong>
                    </div>
                  </td>

                  <td>{employee.id || "—"}</td>

                  <td>
                    <div className="executive-contact">
                      <span>
                        <Mail size={14} />
                        {employee.email || "—"}
                      </span>
                      <span>
                        <Phone size={14} />
                        {employee.phone || "—"}
                      </span>
                    </div>
                  </td>

                  <td>{getRoleLabel(employee.role)}</td>

                  <td>
                    <span
                      className={`status-badge ${
                        (employee.status || "Active") === "Active"
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {employee.status || "Active"}
                    </span>
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        onClick={() => openEditModal(employee)}
                        aria-label="Edit employee"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        onClick={() => deleteEmployee(employee)}
                        aria-label="Delete employee"
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

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="employee-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{editingId ? "Edit Employee" : "Add Employee"}</h2>
                <p>Enter the employee's information below.</p>
              </div>

              <button className="icon-button" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="employee@example.com"
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
                  pattern="[0-9+\-\s()]{7,20}"
                  required
                />
              </div>

              <div className="form-group">
                <label>Employee Role *</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                >
                  <option value="INSIDE_SALES">Inside Sales</option>
                  <option value="OUTSIDE_SALES">Outside Sales</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>

              <div className="form-group">
                <label>Employee Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
                  {editingId ? "Save Changes" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
