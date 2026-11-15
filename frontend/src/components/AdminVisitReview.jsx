import { useCallback, useEffect, useState } from "react"
import { Check, X, RefreshCw, MapPin, Camera, Mic, AlertCircle, FileText } from "lucide-react"
import { adminApi } from "../api/admin.js"
import { formatDateTime, enumLabel } from "../utils/apiMappers.js"

function messageFor(error) {
  return error?.message || "The request could not be completed."
}

export function AdminVisitReview({ onReviewComplete }) {
  const [visits, setVisits] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [rejectingVisit, setRejectingVisit] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [evidenceUrls, setEvidenceUrls] = useState({})
  const [loadingEvidence, setLoadingEvidence] = useState({})

  const loadPendingVisits = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await adminApi.listPendingVisitReviews({ page, pageSize: 10 })
      setVisits(data.visits || [])
      setPagination(data.pagination || null)
    } catch (e) {
      setError(messageFor(e))
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    loadPendingVisits()
  }, [loadPendingVisits])

  const loadEvidenceUrl = useCallback(async (visitId, mediaId) => {
    const key = `${visitId}-${mediaId}`
    if (evidenceUrls[key] || loadingEvidence[key]) return

    setLoadingEvidence((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await adminApi.getEvidenceAccess(visitId, mediaId)
      if (res?.accessUrl) {
        setEvidenceUrls((prev) => ({ ...prev, [key]: res.accessUrl }))
      }
    } catch (e) {
      console.warn("Could not load evidence URL:", e)
    } finally {
      setLoadingEvidence((prev) => ({ ...prev, [key]: false }))
    }
  }, [evidenceUrls, loadingEvidence])

  // Automatically request evidence URLs for selected visit or visible visits
  useEffect(() => {
    if (!selectedVisit) return
    const assets = selectedVisit.mediaAssets || []
    assets.forEach((asset) => {
      loadEvidenceUrl(selectedVisit.id, asset.id)
    })
  }, [selectedVisit, loadEvidenceUrl])

  async function handleApprove(visitId) {
    if (!confirm("Are you sure you want to approve this visit?")) return
    setSubmitting(true)
    setError("")
    setSuccess("")
    try {
      await adminApi.approveVisit(visitId)
      setSuccess("Visit approved successfully.")
      setSelectedVisit(null)
      await loadPendingVisits()
      if (onReviewComplete) onReviewComplete()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject(e) {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.")
      return
    }
    setSubmitting(true)
    setError("")
    setSuccess("")
    try {
      await adminApi.rejectVisit(rejectingVisit.id, rejectionReason.trim())
      setSuccess("Visit rejected successfully.")
      setRejectingVisit(null)
      setRejectionReason("")
      setSelectedVisit(null)
      await loadPendingVisits()
      if (onReviewComplete) onReviewComplete()
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="visit-review-container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FIELD VERIFICATION</span>
          <h1>Visit Reviews</h1>
          <p>Review customer selfies, GPS arrival verification, and voice recordings submitted by Outside Sales.</p>
        </div>
        <button className="secondary-button" onClick={loadPendingVisits} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div className="inline-warning" role="alert">{error}</div>}
      {success && <div className="toast-message" role="status">{success}</div>}

      <section className="card data-page-card">
        {loading ? (
          <div className="empty-state">
            <h3>Loading pending reviews…</h3>
          </div>
        ) : visits.length === 0 ? (
          <div className="empty-state">
            <h3>No visits awaiting review</h3>
            <p>All submitted field visits have been evaluated.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Visit / Date</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Outside Sales</th>
                  <th>GPS Verification</th>
                  <th>Evidence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => {
                  const schedule = visit.schedule || {}
                  const selfie = (visit.mediaAssets || []).find(
                    (m) => m.mediaType === "VISIT_SELFIE" || m.mediaType === "CUSTOMER_SELFIE"
                  )
                  const audio = (visit.mediaAssets || []).find((m) => m.mediaType === "AUDIO_RECORDING")

                  return (
                    <tr key={visit.id}>
                      <td data-label="Visit">
                        <strong>Visit #{visit.id}</strong>
                        <span>{schedule.scheduledAt ? formatDateTime(schedule.scheduledAt) : "—"}</span>
                      </td>
                      <td data-label="Customer">
                        <strong>{schedule.customer?.fullName || `Customer #${schedule.customerId}`}</strong>
                        <span>{schedule.customer?.phone || "—"}</span>
                      </td>
                      <td data-label="Property">
                        <strong>{schedule.property?.title || `Property #${schedule.propertyId}`}</strong>
                        <span>{schedule.property?.location || "—"}</span>
                      </td>
                      <td data-label="Outside Sales">
                        <strong>{schedule.outsideSalesEmployee?.fullName || `Agent #${schedule.outsideSalesEmployeeId}`}</strong>
                        <span>{schedule.outsideSalesEmployee?.email || "—"}</span>
                      </td>
                      <td data-label="GPS Verification">
                        <span
                          className={`status ${
                            visit.verificationResult === "PASSED"
                              ? "success"
                              : visit.verificationResult === "FAILED"
                              ? "danger"
                              : "neutral"
                          }`}
                        >
                          <i />
                          {visit.verificationResult === "PASSED"
                            ? "Verified"
                            : visit.verificationResult === "FAILED"
                            ? "Failed"
                            : "Pending"}
                        </span>
                      </td>
                      <td data-label="Evidence">
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          {selfie && (
                            <span title="Selfie uploaded" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--navy)" }}>
                              <Camera size={15} /> Selfie
                            </span>
                          )}
                          {audio && (
                            <span title="Audio recorded" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--blue)" }}>
                              <Mic size={15} /> Audio
                            </span>
                          )}
                          {!selfie && !audio && <span className="muted">None</span>}
                        </div>
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="secondary-button"
                            onClick={() => setSelectedVisit(visit)}
                          >
                            Review Details
                          </button>
                          <button
                            className="primary-button"
                            style={{ minHeight: "36px", padding: "0 12px" }}
                            disabled={submitting}
                            onClick={() => handleApprove(visit.id)}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            className="secondary-button"
                            style={{ minHeight: "36px", padding: "0 12px", color: "var(--red)", borderColor: "var(--red)" }}
                            disabled={submitting}
                            onClick={() => setRejectingVisit(visit)}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
                className="secondary-button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
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

      {/* Visit Details & Evidence Review Modal */}
      {selectedVisit && (
        <div className="modal-backdrop" onClick={() => setSelectedVisit(null)}>
          <div className="modal-card" style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span>FIELD VISIT VERIFICATION</span>
                <h2>Review Visit #{selectedVisit.id}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedVisit(null)} aria-label="Close">
                <X />
              </button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="detail-row">
                <div>
                  <span>Customer</span>
                  <strong>{selectedVisit.schedule?.customer?.fullName || "—"} ({selectedVisit.schedule?.customer?.phone || "—"})</strong>
                </div>
              </div>
              <div className="detail-row">
                <div>
                  <span>Property</span>
                  <strong>{selectedVisit.schedule?.property?.title || "—"}</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>{selectedVisit.schedule?.property?.location || "—"}</p>
                </div>
              </div>
              <div className="detail-row">
                <div>
                  <span>Outside Sales Agent</span>
                  <strong>{selectedVisit.schedule?.outsideSalesEmployee?.fullName || "—"} ({selectedVisit.schedule?.outsideSalesEmployee?.email || "—"})</strong>
                </div>
              </div>
              <div className="detail-row">
                <div>
                  <span>Scheduled Time</span>
                  <strong>{selectedVisit.schedule?.scheduledAt ? formatDateTime(selectedVisit.schedule.scheduledAt) : "—"}</strong>
                </div>
              </div>
              <div className="detail-row">
                <div>
                  <span>GPS Arrival Verification</span>
                  <strong style={{ color: selectedVisit.verificationResult === "PASSED" ? "var(--green)" : "var(--red)" }}>
                    {selectedVisit.verificationResult === "PASSED" ? "Verified within property boundary" : "Failed / Unverified"}
                  </strong>
                </div>
              </div>

              {selectedVisit.schedule?.notes && (
                <div className="detail-row">
                  <div>
                    <span>Visit Notes</span>
                    <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{selectedVisit.schedule.notes}</p>
                  </div>
                </div>
              )}

              {/* Evidence Section */}
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "8px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Camera size={18} /> Customer Selfie & Audio Recording
                </h3>

                {(!selectedVisit.mediaAssets || selectedVisit.mediaAssets.length === 0) ? (
                  <p className="muted">No media files attached to this visit.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {selectedVisit.mediaAssets.map((asset) => {
                      const urlKey = `${selectedVisit.id}-${asset.id}`
                      const accessUrl = evidenceUrls[urlKey]
                      const isImage = asset.mediaType === "VISIT_SELFIE" || asset.mediaType === "CUSTOMER_SELFIE"
                      const isAudio = asset.mediaType === "AUDIO_RECORDING"

                      return (
                        <div
                          key={asset.id}
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "10px",
                            padding: "14px",
                            background: "#f8fafc",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <strong>{isImage ? "Customer Selfie" : isAudio ? "Conversation Audio Recording" : enumLabel(asset.mediaType)}</strong>
                            <small className="muted">{asset.fileSizeBytes ? `${Math.round(asset.fileSizeBytes / 1024)} KB` : ""}</small>
                          </div>

                          {accessUrl ? (
                            isImage ? (
                              <div style={{ textAlign: "center" }}>
                                <img
                                  src={accessUrl}
                                  alt="Visit selfie"
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "320px",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1",
                                    objectFit: "contain",
                                  }}
                                />
                              </div>
                            ) : isAudio ? (
                              <div style={{ padding: "8px 0" }}>
                                <audio controls src={accessUrl} style={{ width: "100%" }}>
                                  Your browser does not support audio playback.
                                </audio>
                              </div>
                            ) : (
                              <a href={accessUrl} target="_blank" rel="noreferrer" className="secondary-button">
                                View Media
                              </a>
                            )
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", padding: "10px 0" }}>
                              <RefreshCw size={14} className="spin" />
                              <span>Loading authenticated media access...</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedVisit(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ color: "var(--red)", borderColor: "var(--red)" }}
                  disabled={submitting}
                  onClick={() => setRejectingVisit(selectedVisit)}
                >
                  <X size={16} /> Reject
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={submitting}
                  onClick={() => handleApprove(selectedVisit.id)}
                >
                  <Check size={16} /> Approve Visit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Visit Modal with Reason */}
      {rejectingVisit && (
        <div className="modal-backdrop" onClick={() => setRejectingVisit(null)}>
          <div className="modal-card" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span>ACTION REQUIRED</span>
                <h2>Reject Visit #{rejectingVisit.id}</h2>
              </div>
              <button className="icon-button" onClick={() => setRejectingVisit(null)} aria-label="Close">
                <X />
              </button>
            </div>
            <form onSubmit={handleReject} style={{ padding: "20px" }}>
              <p style={{ marginBottom: "14px", color: "var(--muted)", fontSize: "14px" }}>
                Please specify why this visit is being rejected. The outside sales representative will be notified of this reason.
              </p>
              <label className="field-label">
                Rejection Reason *
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="e.g., Customer was not present in selfie, or audio conversation was incomplete."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRejectingVisit(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ background: "var(--red)" }}
                  disabled={submitting || !rejectionReason.trim()}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
