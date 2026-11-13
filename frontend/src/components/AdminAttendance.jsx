import { useCallback, useEffect, useState } from "react";
import { Filter, X } from "lucide-react";
import { adminAttendanceApi } from "../api/attendance.js";
import { formatDateTime, formatDate, enumLabel, toNumericId } from "../utils/apiMappers.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
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

export function AdminAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [notCheckedIn, setNotCheckedIn] = useState([]);
  const [summaryDate, setSummaryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = {
        page,
        pageSize: 20,
        ...(filterEmployeeId ? { employeeId: toNumericId(filterEmployeeId) } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterFrom ? { from: filterFrom } : {}),
        ...(filterTo ? { to: filterTo } : {}),
      };
      const data = await adminAttendanceApi.listAttendance(query);
      setAttendance(data.attendance || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterEmployeeId, filterStatus, filterFrom, filterTo]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = {};
      if (summaryDate) query.date = summaryDate;
      const data = await adminAttendanceApi.getAttendanceSummary(query);
      setSummary(data.summary || null);
      setNotCheckedIn(data.notCheckedInEmployees || []);
      setSummaryDate(data.date || "");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, [summaryDate]);

  useEffect(() => {
    loadAttendance();
    loadSummary();
  }, [loadAttendance, loadSummary]);

  const ATTENDANCE_STATUSES = ["LOGGED_IN", "LOGGED_OUT", "AUTO_LOGGED_OUT"];

  return (
    <div className="card admin-attendance-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ATTENDANCE REPORTING</span>
          <h2>Attendance Reports</h2>
          <p className="muted">
            Monitor employee attendance across the organization.
          </p>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <section className="card summary-card">
        <div className="summary-header">
          <span className="eyebrow">DAILY SUMMARY</span>
          <h3>Today's Overview</h3>
        </div>
        <label className="field-label" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: "auto", padding: 0 }}>
          Summary date
          <input type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} />
        </label>

        {loading ? (
          <div className="empty-state"><h3>Loading summary…</h3></div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-copy">
                <span>Total Employees</span>
                <strong>{summary?.summary?.totalEmployees ?? 0}</strong>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-copy">
                <span>Checked In</span>
                <strong style={{ color: "var(--green)" }}>{summary?.summary?.checkedIn ?? 0}</strong>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-copy">
                <span>Not Checked In</span>
                <strong style={{ color: "var(--red)" }}>{summary?.summary?.notCheckedIn ?? 0}</strong>
              </div>
            </div>
          </div>
        )}

        {summary && summary.summary?.byStatus && (
          <div className="by-status">
            <span className="muted">By status:</span>
            {Object.entries(summary.summary.byStatus).map(([status, count]) => (
              <span key={status} className={`status-chip`} style={{ color: statusColor(status) }}>
                {statusLabel(status)}: {count}
              </span>
            ))}
          </div>
        )}

        {notCheckedIn.length > 0 && (
          <div className="not-checked-in">
            <h4>Not Checked In</h4>
            <ul>
              {notCheckedIn.map((emp) => (
                <li key={emp.id}>
                  {emp.fullName} ({emp.email}) - {enumLabel(emp.role?.name || emp.role)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card records-card">
        <div className="records-header">
          <span className="eyebrow">EMPLOYEE RECORDS</span>
          <h3>Attendance Records</h3>
        </div>

        <div className="filter-toolbar">
          <label className="field-label">
            Employee
            <input
              type="number"
              min="1"
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              placeholder="Employee ID"
            />
          </label>
          <label className="field-label">
            Status
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            From
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </label>
          <label className="field-label">
            To
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </label>
          <button className="secondary-button" onClick={loadAttendance}>
            <Filter size={16} /> Apply
          </button>
          <button className="text-button" onClick={() => {
            setFilterEmployeeId("");
            setFilterStatus("");
            setFilterFrom("");
            setFilterTo("");
            setPage(1);
            loadAttendance();
          }}>
            <X size={16} /> Clear
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><h3>Loading records…</h3></div>
        ) : attendance.length === 0 ? (
          <div className="empty-state">
            <h3>No attendance records</h3>
            <p>No records match the current filters.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Office</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.employee?.fullName || "Unknown"}</strong>
                      <br />
                      <span className="muted">{record.employee?.email || ""}</span>
                    </td>
                    <td>{enumLabel(record.employee?.role?.name || record.employee?.role)}</td>
                    <td>{formatDateTime(record.loginTime)}</td>
                    <td>{record.logoutTime ? formatDateTime(record.logoutTime) : "—"}</td>
                    <td>
                      {record.workingDurationMinutes !== null ? formatDuration(record.workingDurationMinutes) : "—"}
                    </td>
                    <td>
                      <span className={`status-badge`} style={{ color: statusColor(record.status) }}>
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td>{record.officeLocation?.officeName || "—"}</td>
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

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}