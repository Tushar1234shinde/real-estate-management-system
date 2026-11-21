import { useCallback, useState } from "react";
import { Megaphone, Clock } from "lucide-react";
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
        // datetime-local has no timezone; normalize it before sending the API's
        // required ISO-8601 timestamp.
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
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
    <div className="announcement-form-wrapper">
      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <form className="entity-form announcement-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label full">
            Title <span className="muted">*</span>
            <input
              name="title"
              required
              maxLength="160"
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field-label full">
            Content <span className="muted">*</span>
            <textarea
              name="content"
              required
              maxLength="10000"
              rows="5"
              placeholder="Write the announcement body here…"
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
              placeholder="e.g. Policy Update, Holiday, HR"
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
                <option key={p} value={p}>{enumLabel(p)}</option>
              ))}
            </select>
          </label>
          <label className="field-label full">
            Expiry date <span className="muted">(optional)</span>
            <input
              name="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <div className="field-label full" style={{ gap: 8 }}>
            <span>Target roles</span>
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
            </div>
            <span className="role-chip-hint">Leave all unselected to target all employees</span>
          </div>
          <label className="field-label full" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, minHeight: "auto", paddingTop: 4, paddingBottom: 4 }}>
            <input
              name="isPublished"
              type="checkbox"
              style={{ width: 15, height: 15, accentColor: "var(--teal)", flexShrink: 0 }}
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            <span>Publish immediately</span>
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={loading}>
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
