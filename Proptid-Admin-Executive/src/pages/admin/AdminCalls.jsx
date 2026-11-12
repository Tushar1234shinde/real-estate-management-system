
import { useMemo, useState } from "react"
import {
  Phone,
  PhoneCall,
  Clock,
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
  customerId: "",
  employeeId: "",
  date: "",
  time: "",
  duration: "",
  outcome: "Connected",
  notes: "",
}

const outcomes = [
  "Connected",
  "No Answer",
  "Busy",
  "Interested",
  "Follow-up Required",
  "Not Interested",
]

export default function AdminCalls() {
  const [calls, setCalls] = useState(initialData.calls || [])
  const [customers] = useState(initialData.customers || [])
  const [employees] = useState(initialData.employees || [])

  const [search, setSearch] = useState("")
  const [outcomeFilter, setOutcomeFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingCall, setEditingCall] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const salesEmployees = employees.filter((employee) =>
    ["INSIDE_SALES", "OUTSIDE_SALES"].includes(employee.role)
  )

  const getCustomerName = (customerId) =>
    customers.find((customer) => customer.id === customerId)?.name ||
    "Unknown customer"

  const getEmployeeName = (employeeId) =>
    employees.find((employee) => employee.id === employeeId)?.name ||
    "Not assigned"

  const getCallOutcome = (call) => call.outcome || call.status || "Connected"

  const getCallDuration = (call) =>
    call.duration ?? call.durationMinutes ?? 0

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      const customerName = getCustomerName(call.customerId)
      const employeeName = getEmployeeName(call.employeeId)
      const searchText = search.toLowerCase()

      const matchesSearch =
        customerName.toLowerCase().includes(searchText) ||
        employeeName.toLowerCase().includes(searchText) ||
        (call.notes || "").toLowerCase().includes(searchText)

      const matchesOutcome =
        outcomeFilter === "All" ||
        getCallOutcome(call) === outcomeFilter

      return matchesSearch && matchesOutcome
    })
  }, [calls, customers, employees, search, outcomeFilter])

  const openAddModal = () => {
    setEditingCall(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (call) => {
    setEditingCall(call)

    setForm({
      customerId: call.customerId || "",
      employeeId: call.employeeId || "",
      date: call.date || "",
      time: call.time || "",
      duration: String(getCallDuration(call)),
      outcome: getCallOutcome(call),
      notes: call.notes || "",
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCall(null)
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
      !form.employeeId ||
      !form.date ||
      !form.time ||
      form.duration === ""
    ) {
      alert("Please complete all required fields.")
      return
    }

    const duration = Number(form.duration)

    if (!Number.isFinite(duration) || duration < 0) {
      alert("Please enter a valid call duration.")
      return
    }

    const callData = {
      customerId: form.customerId,
      employeeId: form.employeeId,
      date: form.date,
      time: form.time,
      duration,
      outcome: form.outcome,
      notes: form.notes,
    }

    if (editingCall) {
      setCalls((previous) =>
        previous.map((call) =>
          call.id === editingCall.id
            ? { ...call, ...callData }
            : call
        )
      )
    } else {
      setCalls((previous) => [
        ...previous,
        {
          id: `call-${Date.now()}`,
          ...callData,
        },
      ])
    }

    closeModal()
  }

  const deleteCall = (callId) => {
    if (!window.confirm("Are you sure you want to delete this call record?")) {
      return
    }

    setCalls((previous) =>
      previous.filter((call) => call.id !== callId)
    )
  }

  const connectedCalls = calls.filter((call) =>
    ["Connected", "Interested"].includes(getCallOutcome(call))
  ).length

  const followUpCalls = calls.filter((call) =>
    getCallOutcome(call) === "Follow-up Required"
  ).length

  const totalDuration = calls.reduce(
    (total, call) => total + Number(getCallDuration(call) || 0),
    0
  )

  return (
    <div>
      <PageHeading
        title="Call Records"
        description="Monitor employee calling activity and customer interactions."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={17} />
            Add Call Record
          </button>
        }
      />

      {/* CALL STATISTICS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Calls</span>
            <div className="stat-icon blue">
              <Phone size={20} />
            </div>
          </div>
          <h2>{calls.length}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Connected Calls</span>
            <div className="stat-icon green">
              <PhoneCall size={20} />
            </div>
          </div>
          <h2>{connectedCalls}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Follow-ups Required</span>
            <div className="stat-icon orange">
              <PhoneCall size={20} />
            </div>
          </div>
          <h2>{followUpCalls}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Call Duration</span>
            <div className="stat-icon purple">
              <Clock size={20} />
            </div>
          </div>
          <h2>{totalDuration} min</h2>
        </div>
      </div>

      {/* CALL RECORDS TABLE */}
      <div className="card calls-card">
        <div className="calls-toolbar">
          <div>
            <h2>Call History</h2>
            <p>View and manage recorded customer calls.</p>
          </div>

          <div className="calls-filters">
            <label className="employee-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search calls..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="call-filter"
              value={outcomeFilter}
              onChange={(event) => setOutcomeFilter(event.target.value)}
            >
              <option value="All">All Outcomes</option>
              {outcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Employee</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Call Outcome</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCalls.map((call) => (
                <tr key={call.id}>
                  <td>
                    <strong>
                      {getCustomerName(call.customerId)}
                    </strong>
                  </td>

                  <td>{getEmployeeName(call.employeeId)}</td>

                  <td>
                    <div className="call-date">
                      <strong>{call.date || "—"}</strong>
                      <small>{call.time || "—"}</small>
                    </div>
                  </td>

                  <td>{getCallDuration(call)} min</td>

                  <td>
                    <span
                      className={`call-outcome ${getCallOutcome(call)
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                    >
                      {getCallOutcome(call)}
                    </span>
                  </td>

                  <td className="call-notes">
                    {call.notes || "—"}
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        title="Edit call"
                        onClick={() => openEditModal(call)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        title="Delete call"
                        onClick={() => deleteCall(call.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCalls.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-table">
                    No call records found. Add a call record to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT CALL MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal call-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingCall ? "Edit Call Record" : "Add Call Record"}
                </h2>
                <p>Enter the customer call details.</p>
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
                <label>Employee *</label>
                <select
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select employee</option>
                  {salesEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Call Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Call Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Duration (minutes) *</label>
                  <input
                    type="number"
                    name="duration"
                    min="0"
                    step="1"
                    placeholder="Example: 5"
                    value={form.duration}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Call Outcome *</label>
                  <select
                    name="outcome"
                    value={form.outcome}
                    onChange={handleChange}
                    required
                  >
                    {outcomes.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {outcome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Call Notes</label>
                <textarea
                  name="notes"
                  rows="3"
                  placeholder="Enter call discussion or follow-up details..."
                  value={form.notes}
                  onChange={handleChange}
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
                  {editingCall ? "Save Changes" : "Add Call Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
