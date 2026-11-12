
import { useMemo, useState } from "react"
import {
  CalendarDays,
  MapPin,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

const initialData = createInitialData()

const propertyOptions = [
  "Aurora Heights",
  "The Grove Residences",
  "Skyline One",
  "Marina Bay Homes",
]

const emptyForm = {
  customerId: "",
  property: "",
  employeeId: "",
  date: "",
  time: "",
  status: "Scheduled",
  notes: "",
}

export default function AdminVisits() {
  const [visits, setVisits] = useState(initialData.visits || [])
  const [customers] = useState(initialData.customers || [])
  const [employees] = useState(initialData.employees || [])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingVisit, setEditingVisit] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const salesEmployees = employees.filter((employee) =>
    ["INSIDE_SALES", "OUTSIDE_SALES"].includes(employee.role)
  )

  const getCustomerName = (customerId) => {
    return (
      customers.find((customer) => customer.id === customerId)?.name ||
      "Unknown customer"
    )
  }

  const getEmployeeName = (employeeId) => {
    return (
      employees.find((employee) => employee.id === employeeId)?.name ||
      "Not assigned"
    )
  }

  const getVisitCustomerId = (visit) =>
    visit.customerId || visit.customer_id || ""

  const getVisitEmployeeId = (visit) =>
    visit.employeeId ||
    visit.assignedEmployeeId ||
    visit.assignedToId ||
    ""

  const getVisitDate = (visit) =>
    visit.date || visit.visitDate || visit.scheduledDate || ""

  const getVisitTime = (visit) =>
    visit.time || visit.visitTime || ""

  const getVisitProperty = (visit) =>
    visit.property || visit.propertyName || ""

  const getVisitStatus = (visit) => {
    const status = visit.status || "Scheduled"
    const normalized = status.toLowerCase()

    if (normalized === "completed") return "Completed"
    if (normalized === "cancelled") return "Cancelled"
    if (normalized === "rescheduled") return "Rescheduled"

    return "Scheduled"
  }

  const filteredVisits = useMemo(() => {
    return visits.filter((visit) => {
      const customerName = getCustomerName(getVisitCustomerId(visit))
      const property = getVisitProperty(visit)
      const employeeName = getEmployeeName(getVisitEmployeeId(visit))

      const searchText = search.toLowerCase()

      const matchesSearch =
        customerName.toLowerCase().includes(searchText) ||
        property.toLowerCase().includes(searchText) ||
        employeeName.toLowerCase().includes(searchText)

      const matchesStatus =
        statusFilter === "All" ||
        getVisitStatus(visit) === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [visits, customers, employees, search, statusFilter])

  const openAddModal = () => {
    setEditingVisit(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (visit) => {
    setEditingVisit(visit)

    setForm({
      customerId: getVisitCustomerId(visit),
      property: getVisitProperty(visit),
      employeeId: getVisitEmployeeId(visit),
      date: getVisitDate(visit),
      time: getVisitTime(visit),
      status: getVisitStatus(visit),
      notes: visit.notes || "",
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingVisit(null)
    setForm(emptyForm)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (
      !form.customerId ||
      !form.property ||
      !form.employeeId ||
      !form.date ||
      !form.time
    ) {
      alert("Please complete all required fields.")
      return
    }

    if (editingVisit) {
      setVisits((previous) =>
        previous.map((visit) =>
          visit.id === editingVisit.id
            ? {
                ...visit,
                customerId: form.customerId,
                property: form.property,
                employeeId: form.employeeId,
                date: form.date,
                time: form.time,
                status: form.status,
                notes: form.notes,
              }
            : visit
        )
      )
    } else {
      setVisits((previous) => [
        ...previous,
        {
          id: `visit-${Date.now()}`,
          ...form,
        },
      ])
    }

    closeModal()
  }

  const deleteVisit = (visitId) => {
    if (!window.confirm("Are you sure you want to delete this visit?")) {
      return
    }

    setVisits((previous) =>
      previous.filter((visit) => visit.id !== visitId)
    )
  }

  const updateStatus = (visitId, status) => {
    setVisits((previous) =>
      previous.map((visit) =>
        visit.id === visitId
          ? { ...visit, status }
          : visit
      )
    )
  }

  const scheduledCount = visits.filter(
    (visit) => getVisitStatus(visit) === "Scheduled"
  ).length

  const completedCount = visits.filter(
    (visit) => getVisitStatus(visit) === "Completed"
  ).length

  const cancelledCount = visits.filter(
    (visit) => getVisitStatus(visit) === "Cancelled"
  ).length

  return (
    <div>
      <PageHeading
        title="Property Visits"
        description="Schedule, manage and monitor customer property visits."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={17} />
            Schedule Visit
          </button>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Visits</span>
            <div className="stat-icon blue">
              <CalendarDays size={20} />
            </div>
          </div>
          <h2>{visits.length}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Scheduled</span>
            <div className="stat-icon orange">
              <CalendarDays size={20} />
            </div>
          </div>
          <h2>{scheduledCount}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Completed</span>
            <div className="stat-icon green">
              <MapPin size={20} />
            </div>
          </div>
          <h2>{completedCount}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Cancelled</span>
            <div className="stat-icon purple">
              <X size={20} />
            </div>
          </div>
          <h2>{cancelledCount}</h2>
        </div>
      </div>

      <div className="card visits-card">
        <div className="visits-toolbar">
          <div>
            <h2>Visit Schedule</h2>
            <p>Manage all customer property visits.</p>
          </div>

          <div className="visits-filters">
            <label className="employee-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search visits..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="visit-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Property</th>
                <th>Assigned Employee</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredVisits.map((visit) => (
                <tr key={visit.id}>
                  <td>
                    <strong>
                      {getCustomerName(getVisitCustomerId(visit))}
                    </strong>
                  </td>

                  <td>{getVisitProperty(visit) || "—"}</td>

                  <td>
                    {getEmployeeName(getVisitEmployeeId(visit))}
                  </td>

                  <td>
                    <div className="visit-date">
                      <strong>{getVisitDate(visit) || "—"}</strong>
                      <small>{getVisitTime(visit) || "—"}</small>
                    </div>
                  </td>

                  <td>
                    <select
                      className={`visit-status-select ${getVisitStatus(visit)
                        .toLowerCase()
                        .replace(" ", "-")}`}
                      value={getVisitStatus(visit)}
                      onChange={(event) =>
                        updateStatus(visit.id, event.target.value)
                      }
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Rescheduled">Rescheduled</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        title="Edit visit"
                        onClick={() => openEditModal(visit)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        title="Delete visit"
                        onClick={() => deleteVisit(visit.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredVisits.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table">
                    No property visits found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal visit-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingVisit ? "Edit Property Visit" : "Schedule Property Visit"}
                </h2>
                <p>Enter the visit details below.</p>
              </div>

              <button className="icon-button" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer *</label>
                <select
                  name="customerId"
                  value={form.customerId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Property *</label>
                <select
                  name="property"
                  value={form.property}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select property</option>
                  {propertyOptions.map((property) => (
                    <option key={property} value={property}>
                      {property}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Assign Employee *</label>
                <select
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select employee</option>
                  {salesEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role.replaceAll("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Visit Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Visit Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Visit Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Rescheduled">Rescheduled</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Add any visit instructions..."
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-button">
                  {editingVisit ? "Save Changes" : "Schedule Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
