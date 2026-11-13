import { useCallback, useEffect, useState } from "react";
import { Phone, Clock, Plus } from "lucide-react";
import { insideSalesApi } from "../api/insideSales.js";
import { outsideSalesApi } from "../api/outsideSales.js";
import { formatDateTime, enumLabel } from "../utils/apiMappers.js";

const OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "NO_ANSWER", "CALL_BACK", "INVALID_NUMBER"];

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

export function CustomerCallLogs({ customerId, role }) {
  const isInsideSales = role === "INSIDE_SALES";
  const api = isInsideSales ? insideSalesApi : outsideSalesApi;

  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const loadCallLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listCallLogs(customerId);
      setCallLogs(data.callLogs || []);
    } catch (e) {
      setError(messageFor(e));
      setCallLogs([]);
    } finally {
      setLoading(false);
    }
  }, [api, customerId]);

  useEffect(() => {
    loadCallLogs();
  }, [loadCallLogs]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setCreating(true);

    const body = {
      outcome,
      notes: notes.trim() || null,
      ...(propertyId ? { propertyId: Number(propertyId) } : {}),
    };

    try {
      const data = await api.createCallLog(customerId, body);
      setSuccess("Call log created.");
      setCallLogs([data.callLog, ...callLogs]);
      setOutcome("");
      setNotes("");
      setPropertyId("");
      await loadCallLogs();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="card call-logs-card">
        <div className="empty-state"><h3>Loading call logs…</h3></div>
      </div>
    );
  }

  return (
    <div className="card call-logs-card">
      <div className="call-logs-header">
        <span className="eyebrow">CALL LOGS</span>
        <h3>Call History</h3>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <form className="call-log-form" onSubmit={handleCreate}>
        <div className="form-grid">
          <label className="field-label">
            Outcome <span className="muted">*</span>
            <select
              name="outcome"
              required
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">Select outcome</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{enumLabel(o)}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Notes
            <textarea
              name="notes"
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes (optional)"
            />
          </label>
          <label className="field-label">
            Property ID (optional)
            <input
              name="propertyId"
              type="number"
              min="1"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="Property ID"
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={creating}
          >
            {creating ? <Clock size={16} /> : <Plus size={16} />}{' '} Add Call Log
          </button>
        </div>
      </form>

      <section className="call-logs-list">
        {callLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No call logs</h3>
            <p>Add a call log to record customer interactions.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
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
      </section>
    </div>
  );
}

function getOutcomeColor(outcome) {
  switch (outcome) {
    case "INTERESTED":
      return "var(--green)";
    case "NOT_INTERESTED":
      return "var(--red)";
    case "CALL_BACK":
      return "var(--blue)";
    case "NO_ANSWER":
      return "var(--orange)";
    case "INVALID_NUMBER":
      return "var(--muted)";
    default:
      return "var(--ink)";
  }
}