import { useCallback, useState } from "react";
import { Plus, Megaphone, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { announcementsApi } from "../api/announcements.js";
import { AnnouncementList } from "./AnnouncementList.jsx";
import { AnnouncementDetail } from "./AnnouncementDetail.jsx";
import { AnnouncementForm } from "./AnnouncementForm.jsx";
import { AnnouncementStats } from "./AnnouncementStats.jsx";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function AnnouncementPage() {
  const { user } = useAuth();
  const isManage = user?.role === "ADMIN" || user?.role === "EXECUTIVE";

  const [openDetailId, setOpenDetailId] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openStatsId, setOpenStatsId] = useState(null);
  const [editAnnouncement, setEditAnnouncement] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = () => {
    setEditAnnouncement(null);
    setOpenForm(true);
  };

  const handleEdit = (announcement) => {
    setEditAnnouncement(announcement);
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this announcement? This cannot be undone."))
      return;
    try {
      await announcementsApi.remove(id);
      setSuccess("Announcement deleted.");
    } catch (e) {
      setError(messageFor(e));
    }
  };

  const handleRefresh = useCallback(() => {
    setSuccess("");
    setError("");
  }, []);

  const canCreate = isManage;
  const canDelete = isManage;

  return (
    <div className="card announcement-page-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM COMMUNICATION</span>
          <h2>Announcements</h2>
          <p className="muted">
            View and acknowledge team announcements.
          </p>
        </div>
        {canCreate && (
          <button className="primary-button" onClick={handleCreate}>
            <Plus /> New announcement
          </button>
        )}
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <AnnouncementList
        role={user?.role}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={handleRefresh}
      />

      {openDetailId && (
        <AnnouncementDetail
          announcementId={openDetailId}
          onClose={() => setOpenDetailId(null)}
          onRefresh={handleRefresh}
        />
      )}

      {openForm && (
        <AnnouncementForm
          announcement={editAnnouncement}
          onClose={() => {
            setOpenForm(false);
            setEditAnnouncement(null);
          }}
          onSave={handleRefresh}
        />
      )}

      {openStatsId && (
        <AnnouncementStats
          announcementId={openStatsId}
          onClose={() => setOpenStatsId(null)}
        />
      )}
    </div>
  );
}