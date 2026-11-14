import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, MapPin, RefreshCw } from "lucide-react";
import { attendanceApi } from "../api/attendance.js";
import { officeLocationsApi } from "../api/officeLocations.js";
import { formatDateTime, toNumericId } from "../utils/apiMappers.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function statusLabel(status) {
  switch (status) {
    case "LOGGED_IN":
      return "Checked In";
    case "LOGGED_OUT":
      return "Checked Out";
    case "AUTO_LOGGED_OUT":
      return "Auto Checked Out";
    default:
      return status;
  }
}

function statusColor(status) {
  switch (status) {
    case "LOGGED_IN":
      return "var(--green)";
    case "LOGGED_OUT":
      return "var(--red)";
    case "AUTO_LOGGED_OUT":
      return "var(--orange)";
    default:
      return "var(--muted)";
  }
}

export function EmployeeAttendance() {
  const [attendance, setAttendance] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [geoPermission, setGeoPermission] = useState(null);
  const [officeLocations, setOfficeLocations] = useState([]);
  const [officeLocationsLoading, setOfficeLocationsLoading] = useState(false);
  const [officeLocationId, setOfficeLocationId] = useState("");
  const officeSelectedRef = useRef(false);

  const loadToday = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await attendanceApi.myAttendanceForDate(today);
      setTodayStatus(data.status);
      setAttendance(
        data.attendance && data.attendance.length > 0
          ? data.attendance[0]
          : null
      );
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await attendanceApi.myAttendance({ page, pageSize: 20 });
      setHistory(data.attendance || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadOfficeLocations = useCallback(async () => {
    setOfficeLocationsLoading(true);
    setError("");
    try {
      const data = await officeLocationsApi.listActiveOfficeLocations();
      setOfficeLocations(data.officeLocations || []);
      if (
        data.officeLocations &&
        data.officeLocations.length > 0 &&
        !officeSelectedRef.current
      ) {
        setOfficeLocationId(String(data.officeLocations[0].id));
        officeSelectedRef.current = true;
      }
    } catch (e) {
      setError(messageFor(e));
      setOfficeLocations([]);
    } finally {
      setOfficeLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
    loadHistory();
    loadOfficeLocations();
  }, [loadToday, loadHistory, loadOfficeLocations]);

  function getCoords() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      setGeoPermission("requesting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoPermission("granted");
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          setGeoPermission("denied");
          reject(
            new Error(
              err.code === 1
                ? "Location permission denied. Please allow location access to check in."
                : err.code === 2
                ? "Location information is unavailable."
                : "Unable to retrieve location."
            )
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function handleCheckIn() {
    if (checking) return;
    if (!toNumericId(officeLocationId)) {
      setError("Please select an office location.");
      return;
    }

    setError("");
    setSuccess("");
    setChecking(true);

    try {
      const coords = await getCoords();
      const body = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        officeLocationId: toNumericId(officeLocationId),
      };
      const data = await attendanceApi.checkIn(body);
      setSuccess("Checked in successfully.");
      await loadToday();
      await loadHistory();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setChecking(false);
    }
  }

  async function handleCheckOut() {
    if (checking) return;
    setError("");
    setSuccess("");
    setChecking(true);

    try {
      const coords = await getCoords();
      const body = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      const data = await attendanceApi.checkOut(body);
      setSuccess("Checked out successfully.");
      await loadToday();
      await loadHistory();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setChecking(false);
    }
  }

  function handleDateChange(event) {
    const date = event.target.value;
    if (!date) {
      loadToday();
      return;
    }
    setLoading(true);
    setError("");
    attendanceApi
      .myAttendanceForDate(date)
      .then((data) => {
        setTodayStatus(data.status);
        setAttendance(
          data.attendance && data.attendance.length > 0
            ? data.attendance[0]
            : null
        );
      })
      .catch((e) => setError(messageFor(e)))
      .finally(() => setLoading(false));
  }

  const canCheckIn =
    todayStatus !== "LOGGED_IN" && !checking && !!toNumericId(officeLocationId);
  const canCheckOut =
    todayStatus === "LOGGED_IN" && !checking;

  return (
    <div className="card attendance-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ATTENDANCE</span>
          <h2>My Attendance</h2>
          <p className="muted">
            Record your work hours with location verification.
          </p>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <section className="card status-card">
        <div className="status-header">
          <span className="eyebrow">TODAY'S STATUS</span>
          <h3>Today</h3>
        </div>
        <div className="status-display">
          <div className={`status-pill ${todayStatus ? "active" : "idle"}`}>
            <span className="status-dot" style={{ backgroundColor: todayStatus ? statusColor(todayStatus) : "#cbd5e1" }}></span>
            {todayStatus ? statusLabel(todayStatus) : "Not checked in"}
          </div>
          {attendance && (
            <div className="attendance-details">
              <div className="detail-row">
                <span>Check-in</span>
                <strong>{formatDateTime(attendance.loginTime)}</strong>
              </div>
              {attendance.logoutTime && (
                <div className="detail-row">
                  <span>Check-out</span>
                  <strong>{formatDateTime(attendance.logoutTime)}</strong>
                </div>
              )}
              {attendance.workingDurationMinutes !== undefined && (
                <div className="detail-row">
                  <span>Working duration</span>
                  <strong>{formatDuration(attendance.workingDurationMinutes)}</strong>
                </div>
              )}
              {attendance.officeLocation && (
                <div className="detail-row">
                  <span>Office</span>
                  <strong>{attendance.officeLocation.officeName}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="card actions-card">
        <div className="actions-group">
          <button
            className="primary-button"
            disabled={!canCheckIn || geoPermission === "denied"}
            onClick={handleCheckIn}
          >
            {checking && todayStatus !== "LOGGED_IN" ? (
              <>
                <RefreshCw size={16} /> Checking in…
              </>
            ) : (
              <>
                <MapPin size={16} /> Check In
              </>
            )}
          </button>
          <button
            className="secondary-button"
            disabled={!canCheckOut || geoPermission === "denied"}
            onClick={handleCheckOut}
          >
            {checking && todayStatus === "LOGGED_IN" ? (
              <>
                <RefreshCw size={16} /> Checking out…
              </>
            ) : (
              <>
                <Clock size={16} /> Check Out
              </>
            )}
          </button>
        </div>

        <div className="geo-section">
          <label className="field-label">
            Office Location
            <select
              value={officeLocationId}
              onChange={(e) => setOfficeLocationId(e.target.value)}
            >
              <option value="">Select an office</option>
              {officeLocations.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.officeName}{office.address ? ` (${office.address})` : ""}
                </option>
              ))}
            </select>
          </label>
          {officeLocationsLoading && (
            <span className="muted">Loading offices…</span>
          )}
          {officeLocations.length === 0 && !officeLocationsLoading && (
            <span className="muted">No active offices available.</span>
          )}
          <div className="geo-permission">
            <span>Location: </span>
            <span
              className={`geo-status ${geoPermission || "unknown"}`}
            >
              {geoPermission === null
                ? "Not requested"
                : geoPermission === "requesting"
                ? "Requesting…"
                : geoPermission === "granted"
                ? "Granted"
                : "Denied"}
            </span>
          </div>
          {geoPermission === "denied" && (
            <p className="muted">
              Browser location permission is required to check in or out.
            </p>
          )}
        </div>
      </section>

      <section className="card history-card">
        <div className="history-header">
          <span className="eyebrow">ATTENDANCE HISTORY</span>
          <h3>History</h3>
          <label className="field-label" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: "auto", padding: 0 }}>
            Filter by date
            <input
              type="date"
              onChange={handleDateChange}
            />
          </label>
        </div>

        {loading ? (
          <div className="empty-state"><h3>Loading history…</h3></div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <h3>No attendance records</h3>
            <p>Check in to start recording your attendance.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Office</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDateTime(record.loginTime)}</td>
                    <td>{formatDateTime(record.loginTime)}</td>
                    <td>
                      {record.logoutTime ? formatDateTime(record.logoutTime) : "—"}
                    </td>
                    <td>
                      {record.workingDurationMinutes !== null ? formatDuration(record.workingDurationMinutes) : "—"}
                    </td>
                    <td>
                      <span className={`status-badge`} style={{ color: statusColor(record.status) }}>
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td>
                      {record.officeLocation?.officeName || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && (
          <div className="pagination">
            <span>
              Page {pagination.page} of {pagination.totalPages || 1} ·
              {pagination.total} records
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
      </section>
    </div>
  );
}