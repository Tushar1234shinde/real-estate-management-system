import { useCallback, useEffect, useState } from "react";
import { Megaphone, Clock, CheckCircle2, X } from "lucide-react";
import { announcementsApi, adminAnnouncementsApi } from "../api/announcements.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { formatDateTime, enumLabel } from "../utils/apiMappers.js";

const PRIORITY_LABELS = { LOW: "Low", NORMAL: "Normal", HIGH: "High" };

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function AnnouncementDetail({ announcementId, onClose, onRefresh }) {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readLoading, setReadLoading] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  const loadAnnouncement = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await announcementsApi.get(announcementId);
      setAnnouncement(data.announcement);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, [announcementId]);

  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await adminAnnouncementsApi.getReadStatistics(announcementId);
      setStats(data);
    } catch {
      // Stats are optional; ignore errors
    }
  }, [announcementId, isAdmin]);

  useEffect(() => {
    loadAnnouncement();
  }, [loadAnnouncement]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleMarkRead() {
    if (!announcement || announcement.isRead) return;
    setReadLoading(true);
    try {
      await announcementsApi.markRead(announcementId);
      setAnnouncement((prev) =>
        prev
          ? { ...prev, isRead: true, readAt: new Date().toISOString() }
          : prev
      );
      if (onRefresh) onRefresh();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setReadLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="card announcement-detail-card">
        <div className="empty-state"><h3>Loading announcement…</h3></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card announcement-detail-card">
        <div className="empty-state">
          <h3>Unable to load announcement</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="card announcement-detail-card">
        <div className="empty-state"><h3>Announcement not found</h3></div>
      </div>
    );
  }

  return (
    <div className="card announcement-detail-card">
      <div className="detail-header">
        <button className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
        <div>
          <span className="eyebrow">ANNOUNCEMENT DETAILS</span>
          <h2>{announcement.title}</h2>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}

      <div className="announcement-detail-body">
        <div className="announce-icon">
          <Megaphone />
        </div>
        <div>
          <div className="detail-meta">
            <span
              className={`priority-badge`}
              style={{
                color:
                  announcement.priority === "HIGH"
                    ? "var(--red)"
                    : announcement.priority === "LOW"
                    ? "var(--green)"
                    : "var(--blue)",
              }}
            >
              {PRIORITY_LABELS[announcement.priority] || announcement.priority}
            </span>
            <span>{enumLabel(announcement.category || "")}</span>
            <span>
              {announcement.isRead ? "Read" : "Unread"} ·
              {formatDateTime(announcement.createdAt)}
            </span>
            {announcement.createdBy && (
              <span>
                By {announcement.createdBy.fullName} ·
                {enumLabel(announcement.createdBy.role?.name || "")}
              </span>
            )}
          </div>
          <div className="detail-content">
            <p>{announcement.content}</p>
          </div>
          {announcement.expiresAt && (
            <div className="detail-expiry">
              <span>Expires: {formatDateTime(announcement.expiresAt)}</span>
            </div>
          )}
          {announcement.targetRoles && announcement.targetRoles.length > 0 && (
            <div className="detail-audience">
              <span>Audience: </span>
              <span>{announcement.targetRoles
                .map((r) => enumLabel(r))
                .join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {!announcement.isRead && (
        <div className="detail-actions">
          <button
            className="secondary-button"
            disabled={readLoading}
            onClick={handleMarkRead}
          >
            {readLoading ? (
              <Clock size={16} />
            ) : (
              <>
                <CheckCircle2 size={16} /> Mark as read
              </>
            )}
          </button>
        </div>
      )}

      {stats && (
        <div className="detail-stats">
          <h4>Read Statistics</h4>
          <div className="stats-row">
            <div className="stat-item">
              <strong>{stats.readCount}</strong>
              <span>Read</span>
            </div>
            <div className="stat-item">
              <strong>{stats.unreadCount}</strong>
              <span>Unread</span>
            </div>
            <div className="stat-item">
              <strong>{stats.eligibleEmployees}</strong>
              <span>Eligible</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}