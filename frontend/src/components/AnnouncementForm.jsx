import { useCallback, useState } from "react";
import { Megaphone, X, Clock } from "lucide-react";
import { announcementsApi } from "../api/announcements.js";
import { enumLabel } from "../utils/apiMappers.js";

const PRIORITIES = ["LOW", "NORMAL", "HIGH"];
const ROLES = ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"];

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function AnnouncementForm({ announcement, onClose, onSave }) {
  const isEdit = !!announcement;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [category, setCategory] = useState(announcement?.category || "");
  const [priority, setPriority] = useState(announcement?.priority || "NORMAL");
  const [isPublished, setIsPublished] = useState(
    announcement?.isPublished ?? false
  );
  const [expiresAt, setExpiresAt] = useState(
    announcement?.expiresAt ? announcement.expiresAt.slice(0, 16) : ""
  );
  const [targetRoles, setTargetRoles] = useState(
    announcement?.targetRoles || []
  );

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setError("");
      setLoading(true);

      const body = {
        title,
        content,
        category,
        priority,
        isPublished,
        expiresAt: expiresAt || null,
        targetRoles: targetRoles.length > 0 ? targetRoles : [],
      };

      try {
        if (isEdit) {
          await announcementsApi.update(announcement.id, body);
          setSuccess("Announcement updated.");
        } else {
          await announcementsApi.create(body);
          setSuccess("Announcement created.");
        }
        if (onSave) onSave();
      } catch (e) {
        setError(messageFor(e));
      } finally {
        setLoading(false);
      }
    },
    [announcement, isEdit, title, content, category, priority, isPublished, expiresAt, targetRoles, onSave]
  );

  const toggleRole = (role) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  return (
    <div className="card announcement-form-card">
      <div className="form-header">
        <button className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
        <div>
          <span className="eyebrow">
            {isEdit ? "EDIT ANNOUNCEMENT" : "CREATE ANNOUNCEMENT"}
          </span>
          <h2>{isEdit ? "Edit Announcement" : "New Announcement"}</h2>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <form className="announcement-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Title <span className="muted">*</span>
            <input
              name="title"
              required
              maxLength="160"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field-label">
            Content <span className="muted">*</span>
            <textarea
              name="content"
              required
              maxLength="10000"
              rows="6"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <label className="field-label">
            Category <span className="muted">*</span>
            <input
              name="category"
              required
              maxLength="80"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="field-label">
            Priority
            <select
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {enumLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Expiry date (optional)
            <input
              name="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <label className="field-label">
            Target roles
            <div className="role-chips">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-chip ${targetRoles.includes(role) ? "role-chip-selected" : ""}`}
                  onClick={() => toggleRole(role)}
                >
                  {enumLabel(role)}
                </button>
              ))}
              <span className="muted" style={{ fontSize: "11px" }}>
                Leave empty for all employees
              </span>
            </div>
          </label>
          <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8, minHeight: "auto", padding: 0 }}>
            <input
              name="isPublished"
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Publish immediately
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? (
              <Clock size={16} />
            ) : (
              <>
                <Megaphone size={16} />
                {isEdit ? "Save changes" : "Publish"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}