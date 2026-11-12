
import { useState } from "react"
import { Users, Search, Plus, X, Pencil, Trash2 } from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

const roles = [
  "ADMIN",
  "EXECUTIVE",
  "INSIDE_SALES",
  "OUTSIDE_SALES",
]

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "EXECUTIVE",
  status: "Active",
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState(
    () => createInitialData().employees
  )

  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)

  const filteredEmployees = employees.filter((employee) => {
    const searchText = search.toLowerCase()

    return (
      employee.name.toLowerCase().includes(searchText) ||
      employee.id.toLowerCase().includes(searchText) ||
      employee.role.toLowerCase().replaceAll("_", " ").includes(searchText)
    )
  })

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

  function openEditModal(employee) {
    setEditingId(employee.id)

    setFormData({
      name: employee.name,
      email: employee.email || "",
      phone: employee.phone || "",
      role: employee.role,
      status: employee.status,
    })

    setShowModal(true)
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (editingId) {
      setEmployees((previous) =>
        previous.map((employee) =>
          employee.id === editingId
            ? { ...employee, ...formData }
            : employee
        )
      )
    } else {
      const newEmployee = {
        id: `emp-${Date.now()}`,
        ...formData,
      }

      setEmployees((previous) => [...previous, newEmployee])
    }

    setShowModal(false)
    setEditingId(null)
    setFormData(emptyForm)
  }

  function handleDelete(employee) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.name}?`
    )

    if (confirmed) {
      setEmployees((previous) =>
        previous.filter((item) => item.id !== employee.id)
      )
    }
  }

  return (
    <div>
      <PageHeading
        title="Employee Management"
        description="View and manage all employees in your organization."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={15} />
            Add Employee
          </button>
        }
      />

      <div className="card">
        <div className="employee-toolbar">
          <div className="employee-title">
            <Users size={20} />
            <strong>All Employees ({filteredEmployees.length})</strong>
          </div>

          <label className="employee-search">
            <Search size={17} />
            <input
              placeholder="Search employees..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td><strong>{employee.name}</strong></td>
                    <td>{employee.id}</td>
                    <td>{employee.email || "—"}</td>
                    <td>{employee.phone || "—"}</td>
                    <td>{employee.role.replaceAll("_", " ")}</td>
                    <td>
                      <span
                        className={`status-badge ${employee.status.toLowerCase()}`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    <td>
                      <div className="employee-actions">
                        <button
                          className="action-button edit"
                          title="Edit employee"
                          onClick={() => openEditModal(employee)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="action-button delete"
                          title="Delete employee"
                          onClick={() => handleDelete(employee)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal">
            <div className="modal-header">
              <div>
                <h2>{editingId ? "Edit Employee" : "Add New Employee"}</h2>
                <p>Enter the employee details below.</p>
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
                Full Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter employee name"
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
                  required
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
                Employee Role
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Employment Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
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

                <button type="submit" className="primary-button">
                  {editingId ? "Update Employee" : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
