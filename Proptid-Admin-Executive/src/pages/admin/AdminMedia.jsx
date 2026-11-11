
import { useMemo, useState } from "react"
import {
  FileAudio,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Play,
  Headphones,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData } from "../../data/mockData"

const initialData = createInitialData()

const emptyForm = {
  title: "",
  customerId: "",
  employeeId: "",
  recordingType: "Call Recording",
  date: "",
  duration: "",
  audioUrl: "",
  notes: "",
}

export default function AdminMedia() {
  const [media, setMedia] = useState(initialData.media || [])
  const [customers] = useState(initialData.customers || [])
  const [employees] = useState(initialData.employees || [])

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingMedia, setEditingMedia] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [playingId, setPlayingId] = useState(null)

  const salesEmployees = employees.filter((employee) =>
    ["INSIDE_SALES", "OUTSIDE_SALES"].includes(employee.role)
  )

  const getCustomerName = (id) =>
    customers.find((customer) => customer.id === id)?.name ||
    "Unknown customer"

  const getEmployeeName = (id) =>
    employees.find((employee) => employee.id === id)?.name ||
    "Not assigned"

  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      const customerName = getCustomerName(item.customerId)
      const employeeName = getEmployeeName(item.employeeId)
      const searchText = search.toLowerCase()

      const matchesSearch =
        (item.title || "").toLowerCase().includes(searchText) ||
        customerName.toLowerCase().includes(searchText) ||
        employeeName.toLowerCase().includes(searchText)

      const matchesType =
        typeFilter === "All" || item.recordingType === typeFilter

      return matchesSearch && matchesType
    })
  }, [media, customers, employees, search, typeFilter])

  const openAddModal = () => {
    setEditingMedia(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (item) => {
    setEditingMedia(item)

    setForm({
      title: item.title || "",
      customerId: item.customerId || "",
      employeeId: item.employeeId || "",
      recordingType: item.recordingType || "Call Recording",
      date: item.date || "",
      duration: item.duration || "",
      audioUrl: item.audioUrl || "",
      notes: item.notes || "",
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingMedia(null)
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
      !form.title.trim() ||
      !form.customerId ||
      !form.employeeId ||
      !form.date ||
      !form.duration.trim()
    ) {
      alert("Please complete all required fields.")
      return
    }

    const mediaData = {
      ...form,
      title: form.title.trim(),
      duration: form.duration.trim(),
    }

    if (editingMedia) {
      setMedia((previous) =>
        previous.map((item) =>
          item.id === editingMedia.id
            ? { ...item, ...mediaData }
            : item
        )
      )
    } else {
      setMedia((previous) => [
        ...previous,
        {
          id: `media-${Date.now()}`,
          ...mediaData,
        },
      ])
    }

    closeModal()
  }

  const deleteMedia = (mediaId) => {
    if (!window.confirm("Are you sure you want to delete this recording record?")) {
      return
    }

    setMedia((previous) =>
      previous.filter((item) => item.id !== mediaId)
    )
  }

  const callRecordings = media.filter(
    (item) => item.recordingType === "Call Recording"
  ).length

  const otherMedia = media.length - callRecordings

  return (
    <div>
      <PageHeading
        title="Media & Recordings"
        description="Manage call recordings and other media associated with customers."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={17} />
            Add Recording
          </button>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Media Records</span>
            <div className="stat-icon blue">
              <FileAudio size={20} />
            </div>
          </div>
          <h2>{media.length}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Call Recordings</span>
            <div className="stat-icon green">
              <Headphones size={20} />
            </div>
          </div>
          <h2>{callRecordings}</h2>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Other Media</span>
            <div className="stat-icon purple">
              <FileAudio size={20} />
            </div>
          </div>
          <h2>{otherMedia}</h2>
        </div>
      </div>

      <div className="card media-card">
        <div className="media-toolbar">
          <div>
            <h2>Recording Library</h2>
            <p>View and manage stored media records.</p>
          </div>

          <div className="media-filters">
            <label className="employee-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search recordings..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="media-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All Media Types</option>
              <option value="Call Recording">Call Recording</option>
              <option value="Audio">Audio</option>
              <option value="Video">Video</option>
              <option value="Document">Document</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Recording</th>
                <th>Customer</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Playback</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredMedia.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="media-title">
                      <div className="media-file-icon">
                        <FileAudio size={18} />
                      </div>
                      <strong>{item.title}</strong>
                    </div>
                  </td>

                  <td>{getCustomerName(item.customerId)}</td>

                  <td>{getEmployeeName(item.employeeId)}</td>

                  <td>
                    <span className="media-type-badge">
                      {item.recordingType}
                    </span>
                  </td>

                  <td>{item.date || "—"}</td>

                  <td>{item.duration || "—"}</td>

                  <td>
                    {item.audioUrl ? (
                      <button
                        className="media-play-button"
                        onClick={() =>
                          setPlayingId(
                            playingId === item.id ? null : item.id
                          )
                        }
                      >
                        <Play size={14} />
                        {playingId === item.id ? "Close" : "Play"}
                      </button>
                    ) : (
                      <span className="media-unavailable">
                        No audio file
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="employee-actions">
                      <button
                        className="action-button edit"
                        title="Edit recording"
                        onClick={() => openEditModal(item)}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        className="action-button delete"
                        title="Delete recording"
                        onClick={() => deleteMedia(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredMedia.length === 0 && (
                <tr>
                  <td colSpan="8" className="empty-table">
                    No media records found. Add a recording to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredMedia
          .filter((item) => item.audioUrl && playingId === item.id)
          .map((item) => (
            <div className="media-player-panel" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{getCustomerName(item.customerId)}</p>
              </div>

              <audio
                controls
                preload="none"
                src={item.audioUrl}
                onError={() =>
                  alert("The audio file could not be loaded. Check the recording URL.")
                }
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal media-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingMedia ? "Edit Media Record" : "Add Media Record"}
                </h2>
                <p>Enter the recording details below.</p>
              </div>

              <button className="icon-button" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Recording Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Example: Customer follow-up call"
                  required
                />
              </div>

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
                  <label>Media Type *</label>
                  <select
                    name="recordingType"
                    value={form.recordingType}
                    onChange={handleChange}
                  >
                    <option value="Call Recording">Call Recording</option>
                    <option value="Audio">Audio</option>
                    <option value="Video">Video</option>
                    <option value="Document">Document</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Recording Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Duration</label>
                <input
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                  placeholder="Example: 05:30"
                  required
                />
              </div>

              <div className="form-group">
                <label>Audio File URL</label>
                <input
                  type="url"
                  name="audioUrl"
                  value={form.audioUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/recording.mp3"
                />
                <small className="form-help">
                  Enter a publicly accessible audio URL to enable playback.
                </small>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  rows="3"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Add recording details..."
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
                  {editingMedia ? "Save Changes" : "Add Recording"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
