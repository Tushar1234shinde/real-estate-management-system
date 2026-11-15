import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { adminApi } from "../api/admin.js";
import { insideSalesApi } from "../api/insideSales.js";
import { propertiesApi } from "../api/properties.js";
import {
  buildWhatsAppUrl,
  getInterestedMessage,
  getNotInterestedMessage,
  isValidPhoneNumber,
  normalizePhoneNumber,
  openWhatsAppChat,
  WHATSAPP_TEMPLATES,
} from "../utils/whatsApp.js";
import { enumLabel, formatDateTime } from "../utils/apiMappers.js";

function messageFor(error) {
  return error?.message || "The request could not be completed.";
}

function formatFileSize(bytes) {
  if (!bytes) return "—";
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMimeLabel(mimeType) {
  if (!mimeType) return "Document";
  const type = String(mimeType).toLowerCase();
  if (type === "application/pdf") return "PDF";
  if (type === "image/jpeg" || type === "image/jpg") return "JPEG";
  if (type === "image/png") return "PNG";
  if (type === "image/webp") return "WebP";
  return mimeType;
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

export function CustomerWhatsApp({
  customerId,
  customer: propCustomer,
  property: propProperty,
  interestStatus: propInterestStatus,
  role,
  onClose,
}) {
  const isInsideSales = role === "inside-sales" || role === "INSIDE_SALES";
  const api = isInsideSales ? insideSalesApi : adminApi;

  const [customer, setCustomer] = useState(propCustomer || null);
  const [phone, setPhone] = useState(propCustomer?.phone || "");
  const [selectedProperty, setSelectedProperty] = useState(propProperty || null);
  const [availableProperties, setAvailableProperties] = useState(propProperty ? [propProperty] : []);
  const [loadingProperties, setLoadingProperties] = useState(false);

  const [propertyDocuments, setPropertyDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [accessLoading, setAccessLoading] = useState({});

  const [messageContent, setMessageContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load customer details if not provided
  useEffect(() => {
    if (propCustomer) {
      setCustomer(propCustomer);
      if (propCustomer.phone) setPhone(propCustomer.phone);
      return;
    }
    if (!customerId) return;

    let cancelled = false;
    api.getCustomer(customerId)
      .then((data) => {
        if (!cancelled && data?.customer) {
          setCustomer(data.customer);
          if (data.customer.phone) setPhone(data.customer.phone);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(messageFor(e));
      });

    return () => { cancelled = true; };
  }, [api, customerId, propCustomer]);

  // Load available properties for selection
  useEffect(() => {
    let cancelled = false;
    setLoadingProperties(true);

    const fetchProps = isInsideSales
      ? insideSalesApi.listAvailableProperties({ page: 1, pageSize: 100 })
      : propertiesApi.list({ page: 1, pageSize: 100 });

    fetchProps
      .then((data) => {
        if (!cancelled) {
          const list = data.properties || [];
          setAvailableProperties(list);
          if (propProperty) {
            const found = list.find((p) => p.id === propProperty.id);
            if (found) setSelectedProperty(found);
          }
        }
      })
      .catch(() => {
        // Soft fail; keep initial property if provided
      })
      .finally(() => {
        if (!cancelled) setLoadingProperties(false);
      });

    return () => { cancelled = true; };
  }, [isInsideSales, propProperty]);

  // Load documents whenever selected property changes
  useEffect(() => {
    if (!selectedProperty?.id) {
      setPropertyDocuments([]);
      return;
    }

    let cancelled = false;
    setLoadingDocuments(true);

    const fetchDocs = isInsideSales
      ? insideSalesApi.listDocuments(selectedProperty.id, { page: 1, pageSize: 50 })
      : adminApi.listDocuments(selectedProperty.id, { page: 1, pageSize: 50 });

    fetchDocs
      .then((data) => {
        if (!cancelled) {
          setPropertyDocuments(data.documents || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPropertyDocuments([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDocuments(false);
      });

    return () => { cancelled = true; };
  }, [isInsideSales, selectedProperty?.id]);

  // Initialize prefilled message based on interestStatus and property
  const effectiveInterest = propInterestStatus || customer?.interestStatus;

  useEffect(() => {
    const custName = customer?.fullName || "there";
    const propTitle = selectedProperty?.title || "the property";

    if (effectiveInterest === "INTERESTED") {
      setMessageContent(getInterestedMessage(custName, propTitle));
      setSelectedTemplate("interested");
    } else if (effectiveInterest === "NOT_INTERESTED") {
      setMessageContent(getNotInterestedMessage(custName, propTitle));
      setSelectedTemplate("not_interested");
    } else {
      // Scenario C: Customer's Interest Status Is Pending
      // Do not automatically prepare an Interested or Not Interested message.
      // Leave empty or ready for manual text / template selection.
      setSelectedTemplate(null);
    }
  }, [customer?.fullName, selectedProperty?.title, effectiveInterest]);

  // Handle template selection
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id);
    setMessageContent(tpl.getText(customer, selectedProperty));
  };

  // Handle document open/download
  const handleAccessDocument = async (doc) => {
    if (!selectedProperty?.id) return;
    setError("");
    setAccessLoading((prev) => ({ ...prev, [doc.id]: true }));

    try {
      const data = isInsideSales
        ? await insideSalesApi.getDocumentAccess(selectedProperty.id, doc.id)
        : await adminApi.getDocumentAccess(selectedProperty.id, doc.id);

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setError("Could not retrieve document download link.");
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setAccessLoading((prev) => ({ ...prev, [doc.id]: false }));
    }
  };

  // Phone normalization & validation
  const normalizedPhone = useMemo(() => normalizePhoneNumber(phone), [phone]);
  const isPhoneValid = Boolean(normalizedPhone);

  // Click-to-chat open
  const handleOpenWhatsApp = () => {
    setError("");
    setSuccess("");

    if (!isPhoneValid) {
      setError("A valid phone number (10 to 15 digits with country code) is required to open WhatsApp.");
      return;
    }

    const opened = openWhatsAppChat(phone, messageContent);
    if (opened) {
      setSuccess("Opened WhatsApp in a new tab. Please review and send your message, and manually attach any property documents.");
    } else {
      setError("Unable to open WhatsApp URL.");
    }
  };

  // Existing message history loading
  const loadMessages = useCallback(async () => {
    if (!customerId) return;
    setLoadingMessages(true);
    try {
      const data = await api.listWhatsAppMessages(customerId, { page, pageSize: 20 });
      setMessages(data.messages || []);
      setPagination(data.pagination || null);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [api, customerId, page]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <div className="card whatsapp-card" style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div className="call-logs-header" style={{ marginBottom: "14px" }}>
        <div>
          <span className="eyebrow">WHATSAPP CLICK-TO-CHAT</span>
          <h3 style={{ margin: "4px 0 0" }}>
            {customer?.fullName ? `Message ${customer.fullName}` : "WhatsApp Communication"}
          </h3>
        </div>
        {effectiveInterest && (
          <span
            className="status-badge"
            style={{
              background:
                effectiveInterest === "INTERESTED"
                  ? "#edfcf2"
                  : effectiveInterest === "NOT_INTERESTED"
                  ? "#fff1f2"
                  : "#f1f5f9",
              color:
                effectiveInterest === "INTERESTED"
                  ? "#087b3b"
                  : effectiveInterest === "NOT_INTERESTED"
                  ? "#be123c"
                  : "#475569",
              borderColor:
                effectiveInterest === "INTERESTED"
                  ? "#bde8cc"
                  : effectiveInterest === "NOT_INTERESTED"
                  ? "#fecdd3"
                  : "#cbd5e1",
            }}
          >
            Interest: {enumLabel(effectiveInterest)}
          </span>
        )}
      </div>

      {error && <div className="inline-warning" role="alert" style={{ marginBottom: "12px" }}>{error}</div>}
      {success && <div className="toast-message" role="status" style={{ marginBottom: "12px" }}>{success}</div>}

      {/* Recipient Phone Validation */}
      <div style={{ marginBottom: "16px" }}>
        <label className="field-label" style={{ marginBottom: "6px" }}>
          Recipient WhatsApp Number
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210 or +91 98765 43210"
              style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
            {isPhoneValid ? (
              <span className="whatsapp-phone-badge valid" title="Valid phone number for WhatsApp">
                <CheckCircle2 size={15} /> +{normalizedPhone}
              </span>
            ) : (
              <span className="whatsapp-phone-badge invalid" title="Invalid phone number">
                <AlertCircle size={15} /> {phone ? "Invalid number" : "Missing number"}
              </span>
            )}
          </div>
        </label>
        {!isPhoneValid && (
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#b91c1c" }}>
            {phone && phone.includes("*")
              ? "Customer phone is masked in this view. Please provide the destination number before opening WhatsApp."
              : "WhatsApp Click-to-Chat requires a valid phone number (10 to 15 digits)."}
          </p>
        )}
      </div>

      {/* Property Selection & Documents */}
      <div className="whatsapp-section" style={{ marginBottom: "16px" }}>
        <div className="whatsapp-section-title">
          <h4>Property & Documents</h4>
          {selectedProperty && (
            <span style={{ fontSize: "11px", color: "#0f766e", fontWeight: "600" }}>
              {propertyDocuments.length} document{propertyDocuments.length === 1 ? "" : "s"} available
            </span>
          )}
        </div>

        <label className="field-label" style={{ marginBottom: "8px" }}>
          Selected Property
          <select
            className="whatsapp-property-select"
            value={selectedProperty?.id || ""}
            onChange={(e) => {
              const pId = Number(e.target.value);
              const p = availableProperties.find((item) => item.id === pId) || null;
              setSelectedProperty(p);
            }}
          >
            <option value="">Select a property…</option>
            {availableProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.location})
              </option>
            ))}
          </select>
        </label>

        {selectedProperty ? (
          <div>
            <p style={{ margin: "6px 0", fontSize: "11px", color: "#64748b" }}>
              Documents for <strong>{selectedProperty.title}</strong>:
            </p>

            {loadingDocuments ? (
              <p style={{ fontSize: "12px", color: "#64748b" }}>Loading property documents…</p>
            ) : propertyDocuments.length > 0 ? (
              <div className="whatsapp-docs-list">
                {propertyDocuments.map((doc) => {
                  const isPdf = String(doc.mimeType || "").toLowerCase() === "application/pdf";
                  return (
                    <div key={doc.id} className="whatsapp-doc-item">
                      <div className="whatsapp-doc-info">
                        <div className="whatsapp-doc-icon">
                          {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                        </div>
                        <div>
                          <div className="whatsapp-doc-name" title={doc.documentName}>
                            {doc.documentName}
                          </div>
                          <div className="whatsapp-doc-meta">
                            {formatMimeLabel(doc.mimeType)} · {formatFileSize(doc.fileSizeBytes)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: "6px 10px", fontSize: "11px" }}
                        disabled={accessLoading[doc.id]}
                        onClick={() => handleAccessDocument(doc)}
                      >
                        {accessLoading[doc.id] ? (
                          <Clock size={13} />
                        ) : (
                          <Download size={13} />
                        )}{" "}
                        Download / View
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: "6px 0", fontSize: "12px", color: "#64748b" }}>
                No documents uploaded for this property yet. You can still proceed with the WhatsApp text message.
              </p>
            )}

            <div className="whatsapp-notice-box">
              <strong>Notice:</strong> WhatsApp Click-to-Chat (wa.me) supports prefilled text but cannot automatically attach files. Please download/open the documents above and attach them manually in WhatsApp.
            </div>
          </div>
        ) : (
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
            Select a property above to view and access its documents for sharing.
          </p>
        )}
      </div>

      {/* Message Templates & Content */}
      <div style={{ marginBottom: "16px" }}>
        <label className="field-label" style={{ marginBottom: "4px" }}>
          Message Templates
        </label>
        <div className="template-chips">
          {WHATSAPP_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={`template-chip ${selectedTemplate === tpl.id ? "active" : ""}`}
              onClick={() => handleSelectTemplate(tpl)}
            >
              {tpl.label}
            </button>
          ))}
        </div>

        <label className="field-label">
          WhatsApp Message Preview & Editor
          <textarea
            rows="6"
            value={messageContent}
            onChange={(e) => {
              setMessageContent(e.target.value);
              setSelectedTemplate(null);
            }}
            placeholder="Type your WhatsApp message…"
            maxLength="4096"
            style={{ width: "100%", marginTop: "6px", fontSize: "13px", lineHeight: "1.5" }}
          />
        </label>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
          <span>Employee must manually review and send in WhatsApp.</span>
          <span>{messageContent.length} / 4096</span>
        </div>
      </div>

      {/* Primary Click-to-Chat Action */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <button
          type="button"
          className="whatsapp-button"
          disabled={!isPhoneValid}
          onClick={handleOpenWhatsApp}
          style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <MessageCircle size={18} />
          <strong>Open WhatsApp</strong>
          <ExternalLink size={14} />
        </button>
        {onClose && (
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {/* Optional Logged Message History */}
      {messages.length > 0 && (
        <section className="message-history" style={{ borderTop: "1px solid #e7ebf0", paddingTop: "16px" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: "13px" }}>Previous WhatsApp Message History</h4>
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
                    <td data-label="Message">
                      <span className="muted">{enumLabel(msg.messageType)}</span><br />
                      {msg.messageContent}
                    </td>
                    <td data-label="Status">
                      <span className="status-badge" style={{ color: getDeliveryStatusColor(msg.deliveryStatus) }}>
                        {enumLabel(msg.deliveryStatus)}
                      </span>
                    </td>
                    <td data-label="Sent At">{formatDateTime(msg.sentAt || msg.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
