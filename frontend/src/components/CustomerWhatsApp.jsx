import { useCallback, useEffect, useState } from "react";
import { Send, Clock } from "lucide-react";
import { adminApi } from "../api/admin.js";
import { insideSalesApi } from "../api/insideSales.js";
import { formatDateTime, enumLabel } from "../utils/apiMappers.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function getDeliveryStatusColor(status) {
  switch (status) {
    case "DELIVERED": return "var(--green)";
    case "READ": return "var(--blue)";
    case "SENT": return "var(--orange)";
    case "FAILED": return "var(--red)";
    case "PENDING": return "var(--muted)";
    default: return "var(--ink)";
  }
}

export function CustomerWhatsApp({ customerId, role }) {
  const isInsideSales = role === "inside-sales";
  const api = isInsideSales ? insideSalesApi : adminApi;

  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [messageContent, setMessageContent] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listWhatsAppMessages(customerId, { page, pageSize: 20 });
      setMessages(data.messages || []);
      setPagination(data.pagination || null);
    } catch (e) {
      setError(messageFor(e));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [api, customerId, page]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSending(true);

    try {
      await api.sendWhatsAppMessage(customerId, { messageContent: messageContent.trim() });
      setSuccess("Message sent.");
      setMessageContent("");
      await loadMessages();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setSending(false);
    }
  };

  const handlePageChange = (delta) => {
    const nextPage = page + delta;
    if (nextPage < 1 || !pagination || nextPage > pagination.totalPages) return;
    setPage(nextPage);
  };

  if (loading) {
    return (
      <div className="card whatsapp-card">
        <div className="empty-state"><h3>Loading messages…</h3></div>
      </div>
    );
  }

  return (
    <div className="card whatsapp-card">
      <div className="call-logs-header">
        <span className="eyebrow">WHATSAPP</span>
        <h3>Messages</h3>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <section className="message-history">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>No messages</h3>
            <p>Send a WhatsApp message to start a conversation.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id}>
                    <td>
                      <span className="muted">{enumLabel(msg.messageType)}</span><br />
                      {msg.messageContent}
                    </td>
                    <td>
                      <span className={`status-badge`} style={{ color: getDeliveryStatusColor(msg.deliveryStatus) }}>
                        {enumLabel(msg.deliveryStatus)}
                      </span>
                      {msg.outbox && msg.outbox.attemptCount > 1 && (
                        <span className="muted"> · {msg.outbox.attemptCount} attempts</span>
                      )}
                    </td>
                    <td>{formatDateTime(msg.sentAt || msg.createdAt)}</td>
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
                onClick={() => handlePageChange(-1)}
              >
                Previous
              </button>
              <button
                className="secondary-button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <form className="call-log-form" onSubmit={handleSend}>
        <div className="form-grid">
          <label className="field-label full">
            Message
            <textarea
              name="messageContent"
              rows="3"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Type your WhatsApp message…"
              maxLength="4096"
            />
          </label>
          <button
            type="submit"
            className="primary-button"
            disabled={sending || !messageContent.trim()}
          >
            {sending ? <Clock size={16} /> : <Send size={16} />} Send
          </button>
        </div>
      </form>
    </div>
  );
}
