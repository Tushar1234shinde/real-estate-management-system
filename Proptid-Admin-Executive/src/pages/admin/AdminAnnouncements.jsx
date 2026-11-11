
import { useMemo, useState } from "react"
import {
  Megaphone,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  Users,
  Eye,
  EyeOff,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"
import { createInitialData, createId } from "../../data/mockData"

const emptyForm = {
  title: "",
  message: "",
  audience: "All Employees",
  startDate: "",
  endDate: "",
  status: "Draft",
}

export default function AdminAnnouncements() {
  const initialData = createInitialData()

  const [announcements, setAnnouncements] = useState(
    initialData.announcements || []
  )

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const title = item.title || ""
      const message = item.message || item.description || ""
      const audience = item.audience || "All Employees"
      const status = item.status || "Published"

      const matchesSearch =
        `${title} ${message} ${audience}`
          .toLowerCase()
          .includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === "All" ||
        status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [announcements, search, statusFilter])

  const publishedCount = announcements.filter(
    (item) => (item.status || "Published") === "Published"
  ).length

  const draftCount = announcements.filter(
    (item) => item.status === "Draft"
  ).length

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (announcement) => {
    setEditingId(announcement.id)

    setForm({
      title: announcement.title || "",
      message:
        announcement.message || announcement.description || "",
      audience: announcement.audience || "All Employees",
      startDate: announcement.startDate || "",
      endDate: announcement.endDate || "",
      status: announcement.status || "Published",
    })

    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
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

    if (!form.title.trim() || !form.message.trim()) {
      alert("Please enter an announcement title and message.")
      return
    }

    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      alert("End date cannot be earlier than start date.")
      return
    }

    if (editingId) {
      setAnnouncements((previous) =>
        previous.map((item) =>
          item.id === editingId
            ? { ...item, ...form }
            : item
        )
      )
    } else {
      const newAnnouncement = {
        id: createId(),
        ...form,
        createdAt: new Date().toISOString().slice(0, 10),
      }

      setAnnouncements((previous) => [
        newAnnouncement,
        ...previous,
      ])
    }

    closeModal()
  }

  const deleteAnnouncement = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this announcement?"
    )

    if (!confirmed) return

    setAnnouncements((previous) =>
      previous.filter((item) => item.id !== id)
    )
  }

  const togglePublish = (announcement) => {
    const currentStatus = announcement.status || "Published"

    const nextStatus =
      currentStatus === "Published" ? "Draft" : "Published"

    setAnnouncements((previous) =>
      previous.map((item) =>
        item.id === announcement.id
          ? { ...item, status: nextStatus }
          : item
      )
    )
  }

  const formatDate = (date) => {
    if (!date) return "Not set"

    const parsedDate = new Date(`${date}T00:00:00`)

    if (Number.isNaN(parsedDate.getTime())) return date

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div>
      <PageHeading
        title="Announcements"
        description="Create and manage important updates for your organisation."
        action={
          <button className="primary-button" onClick={openAddModal}>
            <Plus size={18} />
            Create Announcement
          </button>
        }
      />

      <div className="stats-grid announcement-stats">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Total Announcements</span>
            <div className="stat-icon blue">
              <Megaphone size={20} />
            </div>
          </div>
          <h2>{announcements.length}</h2>
          <p>All announcements</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Published</span>
            <div className="stat-icon green">
              <Eye size={20} />
            </div>
          </div>
          <h2>{publishedCount}</h2>
          <p>Visible announcements</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Drafts</span>
            <div className="stat-icon orange">
              <EyeOff size={20} />
            </div>
          </div>
          <h2>{draftCount}</h2>
          <p>Not yet published</p>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>Audiences</span>
            <div className="stat-icon purple">
              <Users size={20} />
            </div>
          </div>
          <h2>
            {
              new Set(
                announcements.map(
                  (item) => item.audience || "All Employees"
                )
              ).size
            }
          </h2>
          <p>Different audience groups</p>
        </div>
      </div>

      <div className="announcement-toolbar">
        <label className="employee-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search announcements..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          className="announcement-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

      <div className="announcement-list">
        {filteredAnnouncements.length === 0 ? (
          <div className="card announcement-empty">
            <Megaphone size={36} />
            <h3>No announcements found</h3>
            <p>Create an announcement or change your search filters.</p>
          </div>
        ) : (
          filteredAnnouncements.map((item) => {
            const status = item.status || "Published"

            return (
              <article className="card announcement-card" key={item.id}>
                <div className="announcement-card-top">
                  <div className="announcement-icon">
                    <Megaphone size={21} />
                  </div>

                  <span
                    className={`status-badge ${
                      status === "Published" ? "active" : "inactive"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                <h3>{item.title || "Untitled announcement"}</h3>

                <p className="announcement-message">
                  {item.message || item.description || "No message provided."}
                </p>

                <div className="announcement-details">
                  <span>
                    <Users size={15} />
                    {item.audience || "All Employees"}
                  </span>

                  <span>
                    <CalendarDays size={15} />
                    {formatDate(item.startDate || item.date)}
                  </span>
                </div>

                {item.endDate && (
                  <p className="announcement-end-date">
                    Ends: {formatDate(item.endDate)}
                  </p>
                )}

                <div className="announcement-actions">
                  <button
                    className="secondary-button"
                    onClick={() => togglePublish(item)}
                  >
                    {status === "Published" ? (
                      <>
                        <EyeOff size={15} />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye size={15} />
                        Publish
                      </>
                    )}
                  </button>

                  <button
                    className="action-button edit"
                    onClick={() => openEditModal(item)}
                    aria-label="Edit announcement"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    className="action-button delete"
                    onClick={() => deleteAnnouncement(item.id)}
                    aria-label="Delete announcement"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="employee-modal announcement-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {editingId
                    ? "Edit Announcement"
                    : "Create Announcement"}
                </h2>
                <p>
                  Add an update for your employees.
                </p>
              </div>

              <button className="icon-button" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Announcement Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter announcement title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Write your announcement..."
                  rows="5"
                  required
                />
              </div>

              <div className="form-group">
                <label>Audience</label>
                <select
                  name="audience"
                  value={form.audience}
                  onChange={handleChange}
                >
                  <option>All Employees</option>
                  <option>Admin</option>
                  <option>Executives</option>
                  <option>Inside Sales</option>
                  <option>Outside Sales</option>
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                    min={form.startDate || undefined}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Publication Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>
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
                  {editingId ? "Save Changes" : "Create Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
