import { useCallback, useEffect, useState } from "react";
import {
  Phone,
  Clock,
  Filter,
  X,
  TrendingUp,
  XCircle,
  PhoneOff,
  AlertCircle,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { adminApi } from "../api/admin.js";
import { executiveApi } from "../api/executive.js";
import { formatDateTime, enumLabel, toNumericId } from "../utils/apiMappers.js";

const OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "CALL_BACK", "NO_ANSWER", "INVALID_NUMBER"];
const ROLES = ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"];

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function getOutcomeClass(outcome) {
  switch (outcome) {
    case "INTERESTED":
      return "status-interested";
    case "NOT_INTERESTED":
      return "status-not-interested";
    case "CALL_BACK":
      return "status-call-back";
    case "NO_ANSWER":
      return "status-no-answer";
    case "INVALID_NUMBER":
      return "status-invalid-number";
    default:
      return "status-pending";
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
  const [loadingStats, setLoadingStats] = useState(false);
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
    setLoadingStats(true);
    try {
      const query = {};
      if (filterFrom) query.from = filterFrom;
      if (filterTo) query.to = filterTo;
      const data = await api.getCallLogStatistics(query);
      setStatistics(data);
    } catch {
      // Statistics are optional; ignore errors
    } finally {
      setLoadingStats(false);
    }
  }, [api, filterFrom, filterTo]);

  useEffect(() => {
    loadCallLogs();
  }, [loadCallLogs]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    loadCallLogs();
    loadStatistics();
  };

  const handleClearFilters = () => {
    setFilterEmployeeId("");
    setFilterCustomerId("");
    setFilterOutcome("");
    setFilterRole("");
    setFilterFrom("");
    setFilterTo("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    filterEmployeeId || filterCustomerId || filterOutcome || filterRole || filterFrom || filterTo
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{isAdmin ? "ADMINISTRATION" : "EXECUTIVE"}</span>
          <h1>Call Records</h1>
          <p>Monitor, filter, and analyze customer call interactions across sales teams.</p>
        </div>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      {/* Statistics Overview */}
      <section style={{ marginBottom: "24px" }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Phone />
            </div>
            <div className="stat-copy">
              <span>Total Calls</span>
              <strong>{statistics?.total ?? 0}</strong>
              <small>All logged calls</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <TrendingUp />
            </div>
            <div className="stat-copy">
              <span>Interested</span>
              <strong style={{ color: "var(--green)" }}>
                {statistics?.byOutcome?.INTERESTED ?? 0}
              </strong>
              <small>Positive buyer interest</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">
              <Clock />
            </div>
            <div className="stat-copy">
              <span>Call Back</span>
              <strong style={{ color: "var(--blue)" }}>
                {statistics?.byOutcome?.CALL_BACK ?? 0}
              </strong>
              <small>Follow-up requested</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cyan">
              <PhoneOff />
            </div>
            <div className="stat-copy">
              <span>No Answer</span>
              <strong style={{ color: "var(--orange)" }}>
                {statistics?.byOutcome?.NO_ANSWER ?? 0}
              </strong>
              <small>Unreachable</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <XCircle />
            </div>
            <div className="stat-copy">
              <span>Not Interested</span>
              <strong style={{ color: "var(--red)" }}>
                {statistics?.byOutcome?.NOT_INTERESTED ?? 0}
              </strong>
              <small>Declined</small>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon navy">
              <AlertCircle />
            </div>
            <div className="stat-copy">
              <span>Invalid Number</span>
              <strong>{statistics?.byOutcome?.INVALID_NUMBER ?? 0}</strong>
              <small>Wrong or disconnected</small>
            </div>
          </div>
        </div>

        {statistics?.topEmployees && statistics.topEmployees.length > 0 && (
          <div
            className="card"
            style={{
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "-8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "11px", fontWeight: "700" }}>
              <UserCheck size={15} color="var(--blue)" /> TOP CALLERS:
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {statistics.topEmployees.map((emp) => (
                <span
                  key={emp.employeeId}
                  className="status-badge"
                  style={{ background: "#f8fafc", borderColor: "#cbd5e1", color: "#1e293b" }}
                >
                  Employee #{emp.employeeId} · <strong>{emp.callCount} calls</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Filter Toolbar */}
      <section className="card" style={{ padding: "20px 22px", marginBottom: "24px" }}>
        <form onSubmit={handleApplyFilters}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>
              FILTER CALL RECORDS
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="text-button"
                onClick={handleClearFilters}
                style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <RotateCcw size={13} /> Reset filters
              </button>
            )}
          </div>
          <div className="call-logs-filter-grid">
            <label className="field-label">
              Employee ID
              <input
                type="number"
                min="1"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                placeholder="e.g. 1"
              />
            </label>
            <label className="field-label">
              Customer ID
              <input
                type="number"
                min="1"
                value={filterCustomerId}
                onChange={(e) => setFilterCustomerId(e.target.value)}
                placeholder="e.g. 1"
              />
            </label>
            <label className="field-label">
              Outcome
              <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value)}>
                <option value="">All outcomes</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {enumLabel(o)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Employee Role
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {enumLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              From Date
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </label>
            <label className="field-label">
              To Date
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
            <button type="submit" className="primary-button" style={{ minWidth: "120px" }}>
              <Filter size={15} /> Apply Filters
            </button>
          </div>
        </form>
      </section>

      {/* Records Table */}
      <section className="card data-page-card">
        {loading ? (
          <div className="empty-state">
            <h3>Loading call records…</h3>
          </div>
        ) : callLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No call records found</h3>
            <p>
              {hasActiveFilters
                ? "No call records match your selected filters. Try adjusting or clearing the filters."
                : "No customer call records have been logged yet."}
            </p>
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
                  <th>Property</th>
                  <th>Notes</th>
                  <th>Called At</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Customer">
                      <strong>{log.customer?.fullName || `Customer #${log.customerId}`}</strong>
                      <span>#{log.customerId} · {log.customer?.email || log.customer?.phone || "No details"}</span>
                    </td>
                    <td data-label="Employee">
                      <strong>{log.employee?.fullName || `Employee #${log.employeeId}`}</strong>
                      <span>ID #{log.employeeId}</span>
                    </td>
                    <td data-label="Role">
                      <span className="status-badge" style={{ background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" }}>
                        {enumLabel(log.employee?.role?.name || log.employee?.role || "Staff")}
                      </span>
                    </td>
                    <td data-label="Outcome">
                      <span className={`status-badge ${getOutcomeClass(log.outcome)}`}>
                        {enumLabel(log.outcome)}
                      </span>
                    </td>
                    <td data-label="Property">
                      {log.property ? (
                        <div>
                          <strong>{log.property.title}</strong>
                          <span>ID #{log.property.id}</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td data-label="Notes" style={{ maxWidth: "260px" }}>
                      <span
                        title={log.notes || ""}
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "block",
                        }}
                      >
                        {log.notes || "—"}
                      </span>
                    </td>
                    <td data-label="Called At" style={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(log.calledAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
            </span>
            <div>
              <button
                type="button"
                className="secondary-button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
