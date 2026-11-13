import { useCallback, useEffect, useState } from "react";
import { Phone, Clock, Filter, X, ChartBar } from "lucide-react";
import { adminApi } from "../api/admin.js";
import { executiveApi } from "../api/executive.js";
import { formatDateTime, enumLabel, toNumericId } from "../utils/apiMappers.js";

const OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"];
const ROLES = ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"];

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function getOutcomeColor(outcome) {
  switch (outcome) {
    case "INTERESTED": return "var(--green)";
    case "NOT_INTERESTED": return "var(--red)";
    case "CALL_BACK": return "var(--blue)";
    case "NO_ANSWER": return "var(--orange)";
    case "INVALID_NUMBER": return "var(--muted)";
    default: return "var(--ink)";
  }
}

export function AdminCallLogs({ role }) {
  const isAdmin = role === "admin";
  const api = isAdmin ? adminApi : executiveApi;

  const [callLogs, setCallLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const loadCallLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = {
        page,
        pageSize: 20,
        ...(filterEmployeeId ? { employeeId: toNumericId(filterEmployeeId) } : {}),
        ...(filterCustomerId ? { customerId: toNumericId(filterCustomerId) } : {}),
        ...(filterOutcome ? { outcome: filterOutcome } : {}),
        ...(filterRole ? { role: filterRole } : {}),
        ...(filterFrom ? { from: filterFrom } : {}),
        ...(filterTo ? { to: filterTo } : {}),
      };
      const data = await api.listCallLogs(query);
      setCallLogs(data.callLogs || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setCallLogs([]);
    } finally {
      setLoading(false);
    }
  }, [api, page, filterEmployeeId, filterCustomerId, filterOutcome, filterRole, filterFrom, filterTo]);

  const loadStatistics = useCallback(async () => {
    try {
      const query = {};
      if (filterFrom) query.from = filterFrom;
      if (filterTo) query.to = filterTo;
      const data = await api.getCallLogStatistics(query);
      setStatistics(data);
    } catch {
      // Statistics are optional; ignore errors
    }
  }, [api, filterFrom, filterTo]);

  useEffect(() => {
    loadCallLogs();
    loadStatistics();
  }, [loadCallLogs, loadStatistics]);

  const handleClearFilters = () => {
    setFilterEmployeeId("");
    setFilterCustomerId("");
    setFilterOutcome("");
    setFilterRole("");
    setFilterFrom("");
    setFilterTo("");
    setPage(1);
    loadCallLogs();
    loadStatistics();
  };

  return (
    <div className="card admin-call-logs-card">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CALL LOGS</span>
          <h2>Organization Call Logs</h2>
          <p className="muted">
            View and analyze all customer call interactions.
          </p>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <section className="statistics-section">
        <div className="stats-header">
          <span className="eyebrow">CALL STATISTICS</span>
          <h3>Overview</h3>
        </div>
        {loading ? (
          <div className="empty-state"><h3>Loading statistics…</h3></div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-copy">
                <span>Total Calls</span>
                <strong>{statistics?.total ?? 0}</strong>
              </div>
            </div>
            {statistics?.byOutcome && (
              <div className="by-outcome">
                <span className="muted">By outcome:</span>
                {Object.entries(statistics.byOutcome).map(([outcome, count]) => (
                  <span
                    key={outcome}
                    className={`outcome-chip`}
                    style={{ color: getOutcomeColor(outcome) }}
                  >
                    {enumLabel(outcome)}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {statistics?.topEmployees && statistics.topEmployees.length > 0 && (
          <div className="top-employees">
            <h4>Top Employees</h4>
            <ul>
              {statistics.topEmployees.map((emp) => (
                <li key={emp.employeeId}>
                  Employee #{emp.employeeId} — {emp.callCount} calls
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="records-section">
        <div className="records-header">
          <span className="eyebrow">CALL RECORDS</span>
          <h3>All Call Logs</h3>
        </div>

        <div className="filter-toolbar">
          <label className="field-label">
            Employee ID
            <input
              type="number"
              min="1"
              value={filterEmployeeId}
              onChange={(e) => setFilterEmployeeId(e.target.value)}
              placeholder="Employee ID"
            />
          </label>
          <label className="field-label">
            Customer ID
            <input
              type="number"
              min="1"
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              placeholder="Customer ID"
            />
          </label>
          <label className="field-label">
            Outcome
            <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)}>
              <option value="">All</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{enumLabel(o)}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Role
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">All</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{enumLabel(r)}</option>
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
          <button className="secondary-button" onClick={loadCallLogs}>
            <Filter size={16} /> Apply
          </button>
          <button className="text-button" onClick={handleClearFilters}>
            <X size={16} /> Clear
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><h3>Loading call logs…</h3></div>
        ) : callLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No call logs</h3>
            <p>No call records match the current filters.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Outcome</th>
                  <th>Notes</th>
                  <th>Called At</th>
                  <th>Property</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong>{log.customer?.fullName || "Unknown"}</strong>
                      <br />
                      <span className="muted">#{log.customerId}</span>
                    </td>
                    <td>
                      <strong>{log.employee?.fullName || "Unknown"}</strong>
                    </td>
                    <td>{enumLabel(log.employee?.role?.name || "")}</td>
                    <td>
                      <span className={`status-badge`} style={{ color: getOutcomeColor(log.outcome) }}>
                        {enumLabel(log.outcome)}
                      </span>
                    </td>
                    <td>{log.notes || "—"}</td>
                    <td>{formatDateTime(log.calledAt)}</td>
                    <td>{log.property?.title || "—"}</td>
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