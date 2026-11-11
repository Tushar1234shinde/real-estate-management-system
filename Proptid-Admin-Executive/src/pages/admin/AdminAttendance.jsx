
import { useMemo, useState } from "react"
import {
  Clock,
  CalendarDays,
  Users,
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

const initialData = createInitialData()

const emptyForm = {
  employeeId: "",
  date: new Date().toLocaleDateString("en-CA"),
  status: "Present",
  checkIn: "",
  checkOut: "",
  notes: "",
}

const attendanceStatuses = [
  "Present",
  "Absent",
  "Late",
  "Leave",
]

export default function AdminAttendance() {
  const [attendance, setAttendance] = useState(
    initialData.attendance || []
  )

  const [employees] = useState(initialData.employees || [])

  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState(
    new Date().toLocaleDateString("en-CA")
  )
  const [statusFilter, setStatusFilter] = useState("All")

  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const getEmployeeName = (employeeId) =>
    employees.find((employee) => employee.id === employeeId)?.name ||
    "Unknown employee"

  const getEmployeeRole = (employeeId) =>
    employees.find((employee) => employee.id === employeeId)?.role ||
    "—"

  const filteredAttendance = useMemo(() => {
    return attendance.filter((record) => {
      const employeeName = getEmployeeName(record.employeeId)
      const searchText = search.toLowerCase()

      const matchesSearch =
        employeeName.toLowerCase().includes(searchText) ||
        record.employeeId.toLowerCase().includes(searchText)

      const matchesDate =
        !dateFilter || record.date === dateFilter

      const matchesStatus =
        statusFilter === "All" ||
        record.status === statusFilter

      return matchesSearch && matchesDate && matchesStatus
    })
  }, [attendance, employees, search, dateFilter, statusFilter])

  const openAddModal = () => {
    setEditingRecord(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (record) => {
    setEditingRecord(record)

    setForm({
      employeeId: record.employeeId || "",
      date: record.date || "",
      status: record.status || "Present",
      checkIn: record.checkIn || "",
      checkOut: record.checkOut || "",
      notes: record.notes || "",
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRecord(null)
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

    if (!form.employeeId || !form.date || !form.status) {
      alert("Please complete the required fields.")
      return
    }

    const duplicate = attendance.some(
      (record) =>
        record.employeeId === form.employeeId &&
        record.date === form.date &&
        record.id !== editingRecord?.id
    )

    if (duplicate) {
      alert("An attendance record already exists for this employee on this date.")
      return
    }

    const recordData = {
      employeeId: form.employeeId,
      date: form.date,
      status: form.status,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      notes: form.notes,
    }

    if (editingRecord) {
      setAttendance((previous) =>
        previous.map((record) =>
          record.id === editingRecord.id
            ? { ...record, ...recordData }
            : record
        )
      )
    } else {
      setAttendance((previous) => [
        ...previous,
        {
          id: `attendance-${Date.now()}`,
          ...recordData,
        },
      ])
    }

    closeModal()
  }

  const deleteRecord = (recordId) => {
    if (!window.confirm("Delete this attendance record?")) {
      return
    }

    setAttendance((previous) =>
      previous.filter((record) => record.id !== recordId)
    )
  }

  const today = new Date().toLocaleDateString("en-CA")

  const todayRecords = attendance.filter(
    (record) => record.date === today
  )

  const presentCount = todayRecords.filter(
    (record) => record.status === "Present"
  ).length

  const absentCount = todayRecords.filter(
    (record) => record.status === "Absent"
  ).length

  const lateCount = todayRecords.filter(
    (record) => record.status === "Late"
  ).length

  const leaveCount = todayRecords.filter(
    (record) => record.status === "Leave"
  ).length

  return (
    <div>
      <PageHeading
        title="Attendance Management"
        description="Track employee attendance, working hours and daily status."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={17} />
            Mark Attendance
          </button>
        }
      />

      {/* ATTENDANCE SUMMARY */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Employees</span>
            <div className="stat-icon blue">
              <Users size={20} />
            </div>
          </div>
          <h2>{employees.length}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Present Today</span>
            <div className="stat-icon green">
              <UserCheck size={20} />
            </div>
          </div>
          <h2>{presentCount}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Absent Today</span>
            <div className="stat-icon orange">
              <Users size={20} />
            </div>
          </div>
          <h2>{absentCount}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Late / On Leave</span>
            <div className="stat-icon purple">
              <Clock size={20} />
            </div>
          </div>
          <h2>{lateCount + leaveCount}</h2>
        </div>
      </div>

      {/* ATTENDANCE TABLE */}
      <div className="card attendance-card">
        <div className="attendance-toolbar">
          <div>
            <h2>Employee Attendance Records</h2>
            <p>View and manage daily attendance.</p>
          </div>

          <div className="attendance-filters">
            <label className="attendance-date-filter">
              <CalendarDays size={16} />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              />
            </label>

            <label className="employee-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search employee..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="attendance-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All Statuses</option>
              {attendanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAttendance.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{getEmployeeName(record.employeeId)}</strong>
                  </td>

                  <td>{record.employeeId}</td>

                  <td>
                    {getEmployeeRole(record.employeeId)
                      .replaceAll("_", " ")}
                  </td>

                  <td>{record.date || "—"}</td>

                  <td>{record.checkIn || "—"}</td>

                  <td>{record.checkOut || "—"}</td>

                  <td>
                    <span
                      className={`attendance-status ${record.status
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {record.status}
                    </span>
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        title="Edit attendance"
                        onClick={() => openEditModal(record)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        title="Delete attendance"
                        onClick={() => deleteRecord(record.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-table">
                    No attendance records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT ATTENDANCE MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal attendance-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingRecord ? "Edit Attendance" : "Mark Attendance"}
                </h2>
                <p>Enter the employee's attendance details.</p>
              </div>

              <button className="icon-button" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Employee *</label>
                <select
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select employee</option>

                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} — {employee.role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Attendance Date *</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Attendance Status *</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  required
                >
                  {attendanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Check-in Time</label>
                  <input
                    type="time"
                    name="checkIn"
                    value={form.checkIn}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Check-out Time</label>
                  <input
                    type="time"
                    name="checkOut"
                    value={form.checkOut}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  rows="3"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Add attendance remarks..."
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
                  {editingRecord ? "Save Changes" : "Mark Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
