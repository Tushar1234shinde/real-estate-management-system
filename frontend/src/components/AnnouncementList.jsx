import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Clock, CheckCircle2 } from "lucide-react";
import { announcementsApi } from "../api/announcements.js";
import { formatDateTime, enumLabel } from "../utils/apiMappers.js";

const PRIORITY_LABELS = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function AnnouncementList({ role, onEdit, onDelete, onStats, onRefresh }) {
  const [announcements, setAnnouncements] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [readLoading, setReadLoading] = useState({});
  const [deleting, setDeleting] = useState({});
  const readAnnounced = useRef(new Set());

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await announcementsApi.list({ page, pageSize: 20 });
      setAnnouncements(data.announcements || []);
      setPagination(data.pagination || null);
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(messageFor(e));
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [page, onRefresh]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function handleMarkRead(announcement) {
    if (announcement.isRead) return;
    if (readAnnounced.current.has(announcement.id)) return;
    readAnnounced.current.add(announcement.id);

    setReadLoading({ ...readLoading, [announcement.id]: true });
    try {
      await announcementsApi.markRead(announcement.id);
      setSuccess("Marked as read.");
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcement.id
            ? { ...a, isRead: true, readAt: new Date().toISOString() }
            : a
        )
      );
      readAnnounced.current.delete(announcement.id);
    } catch (e) {
      readAnnounced.current.delete(announcement.id);
      setError(messageFor(e));
    } finally {
      setReadLoading({});
    }
  }

  async function handleDeleteItem(id) {
    if (!onDelete) return;
    if (!window.confirm("Delete this announcement? This cannot be undone."))
      return;
    setDeleting({ ...deleting, [id]: true });
    try {
      await onDelete(id);
      setSuccess("Announcement deleted.");
      await loadAnnouncements();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setDeleting({});
    }
  }

  return (
    <div className="card announcement-list-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM COMMUNICATION</span>
          <h2>Announcements</h2>
          <p className="muted">
            View and acknowledge team announcements.
          </p>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      {loading ? (
        <div className="empty-state"><h3>Loading announcements…</h3></div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <h3>No announcements</h3>
          <p>There are no announcements available at this time.</p>
        </div>
      ) : (
        <div className="announcement-layout">
          <section className="card">
            {announcements.map((item) => (
              <article
                className={`announcement ${item.isRead ? "announcement-read" : ""}`}
                key={item.id}
              >
                <div className="announce-icon">
                  <Megaphone />
                </div>
                <div>
                  <div className="announcement-title">
                    <h3>{item.title}</h3>
                    <span>
                      {PRIORITY_LABELS[item.priority] || item.priority} ·
                      {enumLabel(item.category || "")}
                    </span>
                  </div>
                  <p>{item.content}</p>
                  <div className="announcement-meta">
                    <span>
                      {item.isRead
                        ? `Read ${formatDateTime(item.readAt)}`
                        : "Unread"}
                    </span>
                    <span className="muted">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="announcement-actions">
                    {!item.isRead && (
                      <button
                        className="text-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(item);
                        }}
                        disabled={readLoading[item.id]}
                      >
                        {readLoading[item.id] ? (
                          <Clock size={14} />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Mark read
                          </>
                        )}
                      </button>
                    )}
                    {role === "ADMIN" || role === "EXECUTIVE" ? (
                      <>
                        {onEdit && (
                          <button
                            className="text-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="text-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            disabled={deleting[item.id]}
                          >
                            {deleting[item.id] ? (
                              <Clock size={14} />
                            ) : (
                              <span>Delete</span>
                            )}
                          </button>
                        )}
                        {onStats && (
                          <button
                            className="text-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStats(item);
                            }}
                          >
                            Read status
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      {pagination && (
        <div className="pagination">
          <span>
            Page {pagination.page} of {pagination.totalPages || 1} ·
            {pagination.total} announcements
          </span>
          <div>
            <button
              className="secondary-button"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
