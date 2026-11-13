import { useCallback, useEffect, useState } from "react";
import { Megaphone, X, Clock } from "lucide-react";
import { adminAnnouncementsApi } from "../api/announcements.js";
import { formatDateTime } from "../utils/apiMappers.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function AnnouncementStats({ announcementId, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminAnnouncementsApi.getReadStatistics(announcementId);
      setStats(data);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, [announcementId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await adminAnnouncementsApi.getReadStatistics(announcementId);
      setStats(data);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="card announcement-stats-card">
        <div className="empty-state"><h3>Loading statistics…</h3></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card announcement-stats-card">
        <div className="empty-state">
          <h3>Unable to load statistics</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card announcement-stats-card">
        <div className="empty-state"><h3>Statistics not available</h3></div>
      </div>
    );
  }

  return (
    <div className="card announcement-stats-card">
      <div className="stats-header">
        <div>
          <span className="eyebrow">READ STATISTICS</span>
          <h2>Announcement Reads</h2>
          <p className="muted">{stats.announcement.title}</p>
        </div>
        <button className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-copy">
            <span>Read Count</span>
            <strong style={{ color: "var(--green)" }}>{stats.readCount}</strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-copy">
            <span>Unread Count</span>
            <strong style={{ color: "var(--red)" }}>{stats.unreadCount}</strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-copy">
            <span>Eligible Employees</span>
            <strong>{stats.eligibleEmployees}</strong>
          </div>
        </div>
      </div>

      <div className="stats-actions">
        <button
          className="secondary-button"
          disabled={refreshing}
          onClick={handleRefresh}
        >
          {refreshing ? <Clock size={16} /> : <Megaphone size={16} />} Refresh
        </button>
        <button className="secondary-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}