import { useCallback, useEffect, useState } from "react";
import { Plus, X, Save, RefreshCw } from "lucide-react";
import { officeLocationsApi } from "../api/officeLocations.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function statusColor(isActive) {
  return isActive ? "var(--green)" : "var(--red)";
}

export function AdminOfficeLocations() {
  const [officeLocations, setOfficeLocations] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [officeName, setOfficeName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState("200");

  const loadOfficeLocations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await officeLocationsApi.listAllOfficeLocations({ page, pageSize: 20 });
      setOfficeLocations(data.officeLocations || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setOfficeLocations([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadOfficeLocations();
  }, [loadOfficeLocations]);

  const openAddModal = () => {
    setEditingId(null);
    setOfficeName("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setAllowedRadiusMeters("200");
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const openEditModal = (record) => {
    setEditingId(record.id);
    setOfficeName(record.officeName || "");
    setAddress(record.address || "");
    setLatitude(String(record.latitude || ""));
    setLongitude(String(record.longitude || ""));
    setAllowedRadiusMeters(String(record.allowedRadiusMeters || "200"));
    setError("");
    setSuccess("");
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingId(null);
  };
  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const body = {
        officeName: officeName.trim(),
        address: address.trim() || null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        allowedRadiusMeters: Number(allowedRadiusMeters),
      };
      if (editingId) {
        await officeLocationsApi.updateOfficeLocation(editingId, body);
        setSuccess("Office location updated.");
      } else {
        await officeLocationsApi.createOfficeLocation(body);
        setSuccess("Office location created.");
      }
      closeModal();
      await loadOfficeLocations();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (record) => {
    setError("");
    setSuccess("");
    try {
      await officeLocationsApi.toggleOfficeLocationStatus(record.id);
      setSuccess(`Office location ${record.isActive ? "deactivated" : "activated"}.`);
      await loadOfficeLocations();
    } catch (e) {
      setError(messageFor(e));
    }
  };

  const handlePageChange = (delta) => {
    const nextPage = page + delta;
    if (nextPage < 1 || !pagination || nextPage > pagination.totalPages) return;
    setPage(nextPage);
  };

  if (loading) {
    return (
      <div className="card admin-office-locations-card">
        <div className="empty-state"><h3>Loading office locations…</h3></div>
      </div>
    );
  }


  return (
    <div className="card admin-office-locations-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OFFICE LOCATIONS</span>
          <h2>Office Locations</h2>
          <p className="muted">Manage organizational office locations for attendance check-in.</p>
        </div>
        <button className="primary-button" onClick={openAddModal} disabled={saving}>
          {saving ? <RefreshCw size={16} /> : <Plus size={16} />} Add Office
        </button>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      {officeLocations.length === 0 ? (
        <div className="empty-state">
          <h3>No office locations</h3>
          <p>Add an office location to get started.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Office Name</th>
                <th>Address</th>
                <th>Coordinates</th>
                <th>Radius (m)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {officeLocations.map((office) => (
                <tr key={office.id}>
                  <td><strong>{office.officeName}</strong></td>
                  <td>{office.address || "—"}</td>
                  <td>{office.latitude}, {office.longitude}</td>
                  <td>{office.allowedRadiusMeters}</td>
                  <td>
                    <span className={`status-badge`} style={{ color: statusColor(office.isActive) }}>
                      {office.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="secondary-button" onClick={() => openEditModal(office)}>
                      <Save size={16} /> Edit
                    </button> {" "}
                    <button className="text-button" onClick={() => handleToggle(office)}>
                      {office.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <div className="pagination">
          <span>Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} records</span>
          <div>
            <button className="secondary-button" disabled={pagination.page <= 1} onClick={() => handlePageChange(-1)}>
              Previous
            </button>
            <button className="secondary-button" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(1)}>
              Next
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <span>OFFICE LOCATION</span>
                <h2>{editingId ? "Edit Office" : "Add Office"}</h2>
              </div>
              <button className="icon-button" onClick={closeModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <form className="entity-form" onSubmit={handleSave}>
              <div className="form-grid">
                <label className="field-label full">
                  Office Name <span className="muted">*</span>
                  <input name="officeName" required value={officeName} onChange={(e) => setOfficeName(e.target.value)} maxLength={120} />
                </label>
                <label className="field-label full">
                  Address
                  <input name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address, city" maxLength={500} />
                </label>
                <label className="field-label">
                  Latitude <span className="muted">*</span>
                  <input name="latitude" type="number" step="any" min="-90" max="90" required value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                </label>
                <label className="field-label">
                  Longitude <span className="muted">*</span>
                  <input name="longitude" type="number" step="any" min="-180" max="180" required value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </label>
                <label className="field-label">
                  Geofence Radius (m)
                  <input name="allowedRadiusMeters" type="number" min="1" max="100000" value={allowedRadiusMeters} onChange={(e) => setAllowedRadiusMeters(e.target.value)} />
                </label>
              </div>
              {error && <p className="field-error form-error">{error}</p>}
              <div className="form-footer">
                <button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? <Save size={16} /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
