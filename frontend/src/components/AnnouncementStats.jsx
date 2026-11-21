import { useCallback, useEffect, useState } from "react";
import { Megaphone, Clock, CheckCircle2, Users } from "lucide-react";
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
      <div className="announcement-stats-wrapper">
        <div className="empty-state"><h3>Loading statistics…</h3></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="announcement-stats-wrapper">
        <div className="empty-state">
          <h3>Unable to load statistics</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="announcement-stats-wrapper">
        <div className="empty-state"><h3>Statistics not available</h3></div>
      </div>
    );
  }

  return (
    <div className="announcement-stats-wrapper" style={{ padding: "20px" }}>
      {stats.announcement?.title && (
        <p className="muted" style={{ margin: "0 0 16px", fontWeight: "600" }}>
          {stats.announcement.title}
        </p>
      )}

      {error && <div className="inline-warning" role="alert">{error}</div>}

      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "var(--green)" }}><CheckCircle2 size={22} /></div>
          <div className="stat-copy">
            <span>Read Count</span>
            <strong style={{ color: "var(--green)" }}>{stats.readCount}</strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ color: "var(--red)" }}><Clock size={22} /></div>
          <div className="stat-copy">
            <span>Unread Count</span>
            <strong style={{ color: "var(--red)" }}>{stats.unreadCount}</strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Users size={22} /></div>
          <div className="stat-copy">
            <span>Eligible Employees</span>
            <strong>{stats.eligibleEmployees}</strong>
          </div>
        </div>
      </div>

      <div className="table-actions" style={{ justifyContent: "flex-end" }}>
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