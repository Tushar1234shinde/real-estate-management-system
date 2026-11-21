import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router"
import { CalendarDays, Contact, FileText, Home, MapPin, Menu, Mic, RefreshCw, Upload, Users, X, Square, Play, CheckCircle } from "lucide-react"
import { useAuth } from "../auth/AuthContext.jsx"
import { outsideSalesApi } from "../api/outsideSales.js"
import { visitsApi } from "../api/visits.js"
import { enumLabel, formatDateTime } from "../utils/apiMappers.js"
import { PropertyDocuments } from "../components/PropertyDocuments.jsx"
import { CustomerCallLogs } from "../components/CustomerCallLogs.jsx"
import { EmployeeAttendance } from "../components/EmployeeAttendance.jsx"
import { AnnouncementList } from "../components/AnnouncementList.jsx"

const nav = [
  ["overview", "Today's Visits", Home],
  ["customers", "Assigned Customers", Contact],
  ["visits", "Visit History", CalendarDays],
  ["announcements", "Announcements", FileText],
  ["attendance", "Attendance", CalendarDays],
  ["profile", "My Profile", Users]
]

const messageFor = error => error?.message || "The request could not be completed."
const statusLabel = visit => visit?.status === "PENDING_REVIEW" ? "Pending review" : visit?.status === "COMPLETED" ? "Approved" : visit?.status === "REJECTED" ? "Rejected" : enumLabel(visit?.status || "SCHEDULED")

function Shell({ section, children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="app-logo">
            <img src="/proplattice-logo.png" alt="PropLattice" />
            <div>PROPLATTICE<small>REAL ESTATE, IN SYNC</small></div>
          </div>
          <button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
        </div>
        <nav aria-label="Workspace navigation">
          <span className="nav-heading">WORKSPACE</span>
          {nav.map(([id, label, Icon]) => (
            <NavLink key={id} to={`/app/outside-sales/${id}`} onClick={() => setOpen(false)} className={section === id ? "active" : ""}>
              <Icon /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{(user?.name || "U").slice(0, 1)}</div>
          <div><strong>{user?.name || "Outside Sales"}</strong><small>Outside Sales Employee</small></div>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="topbar-brand">
            <img src="/proplattice-logo.png" alt="PropLattice" />
            <span>PROPLATTICE</span>
          </div>
          <div className="top-actions">
            <div className="header-profile">
              <div className="avatar">{(user?.name || "U").slice(0, 1)}</div>
              <span>{user?.name || "Outside Sales"}</span>
            </div>
            <button className="text-button" onClick={() => { signOut(); navigate("/") }}>Log out</button>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

function Failure({ error, retry }) {
  return (
    <div className="empty-state">
      <h3>Unable to load visits</h3>
      <p>{error}</p>
      <button className="secondary-button" onClick={retry}><RefreshCw size={16} /> Retry</button>
    </div>
  )
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location services are unavailable on this device."))
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => reject(new Error(error.message || "Unable to get your current location.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function VisitWorkflow({ schedule, onChange, onClose }) {
  const [visit, setVisit] = useState(schedule.visit)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [selfie, setSelfie] = useState(null)
  const [audio, setAudio] = useState(null)
  const [selfieUploaded, setSelfieUploaded] = useState(false)
  const [audioUploaded, setAudioUploaded] = useState(false)
  const [pageHidden, setPageHidden] = useState(() => typeof document !== "undefined" && document.hidden)

  // MediaRecorder states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null)
  const [recorderSupported, setRecorderSupported] = useState(true)
  const [recorderNotice, setRecorderNotice] = useState("")

  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  const apply = next => { setVisit(next); onChange(schedule.id, next) }

  useEffect(() => {
    const onVisibilityChange = () => setPageHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // Check MediaRecorder support
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecorderSupported(false)
    }
  }, [])

  // Clean up audio streams on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }
    }
  }, [audioPreviewUrl])

  async function initialize() {
    setBusy("initialize")
    setError("")
    try {
      const data = await visitsApi.initialize(schedule.id)
      apply(data.visit)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy("")
    }
  }

  async function verify() {
    setBusy("verify")
    setError("")
    try {
      const location = await getLocation()
      const data = await visitsApi.verifyLocation(visit.id, location)
      apply(data.visit)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy("")
    }
  }

  // Start browser audio recording
  async function startRecording() {
    setError("")
    setRecorderNotice("")
    if (!recorderSupported) {
      setError("Browser audio recording is not supported in this browser. Please use the manual audio file upload below.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      audioChunksRef.current = []

      // Pick supported format
      let mimeType = "audio/webm"
      let ext = "webm"
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus"
        ext = "webm"
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm"
        ext = "webm"
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus"
        ext = "ogg"
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4"
        ext = "mp4"
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const rawType = mimeType.split(";")[0]
        const blob = new Blob(audioChunksRef.current, { type: rawType })
        const file = new File([blob], `conversation-${Date.now()}.${ext}`, { type: rawType })
        setAudio(file)
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
        const previewUrl = URL.createObjectURL(blob)
        setAudioPreviewUrl(previewUrl)
        setRecorderNotice("Conversation audio recorded. Preview below, then click 'Upload Audio' to save it.")
      }

      recorder.start(1000)
      setIsRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Microphone permission denied. Please grant microphone access in your browser settings or select an audio file manually.")
      } else {
        setError(`Unable to start audio recording: ${err.message || "Unknown error"}`)
      }
    }
  }

  // Stop browser audio recording
  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    setIsRecording(false)
  }

  async function upload(kind) {
    const file = kind === "selfie" ? selfie : audio
    if (!file) {
      setError(`Select or record a ${kind} first.`)
      return
    }
    setBusy(kind)
    setError("")
    try {
      if (kind === "selfie") {
        await visitsApi.uploadSelfie(visit.id, file)
        setSelfie(null)
        setSelfieUploaded(true)
      } else {
        await visitsApi.uploadAudio(visit.id, file)
        setAudio(null)
        setAudioUploaded(true)
      }
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy("")
    }
  }

  async function submit() {
    setBusy("submit")
    setError("")
    try {
      const data = await visitsApi.submit(visit.id)
      apply(data.visit)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: "620px", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <span className="eyebrow">VISIT WORKFLOW</span>
        <h2>{schedule.customer?.fullName || `Customer #${schedule.customerId}`}</h2>
        <p>{schedule.property?.title || `Property #${schedule.propertyId}`}</p>

        {pageHidden && (
          <div className="inline-warning" role="status">
            Visit controls are foreground-only. Return to this screen and keep this tab active during your visit.
          </div>
        )}
        {error && <div className="inline-warning" role="alert">{error}</div>}
        {recorderNotice && <div className="toast-message" role="status">{recorderNotice}</div>}

        {!visit ? (
          <button className="primary-button" disabled={busy} onClick={initialize}>
            {busy === "initialize" ? "Starting…" : "Reached location"}
          </button>
        ) : (
          <div className="entity-form">
            <p><strong>Visit status:</strong> {statusLabel(visit)}</p>
            <p><strong>Location:</strong> {visit.verificationResult === "PASSED" ? "Verified" : visit.verificationResult === "FAILED" ? "Failed" : "Not verified"}</p>

            {visit.status === "IN_PROGRESS" && visit.verificationResult === "PENDING" && (
              <button className="primary-button" disabled={busy} onClick={verify}>
                <MapPin size={16} />{busy === "verify" ? "Verifying location…" : "Reached location"}
              </button>
            )}

            {visit.status === "IN_PROGRESS" && visit.verificationResult === "PASSED" && (
              <>
                {/* 1. MANDATORY SELFIE */}
                <div style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "16px", background: "#f8fafc" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>
                    1. Customer Selfie Verification *
                  </h3>
                  <label className="field-label">
                    Take / Upload Selfie with Customer
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setSelfie(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy || !selfie}
                    onClick={() => upload("selfie")}
                    style={{ marginTop: "8px" }}
                  >
                    <Upload size={16} />{busy === "selfie" ? "Uploading selfie…" : "Upload selfie"}
                  </button>
                  {selfieUploaded && (
                    <p className="toast-message" style={{ marginTop: "8px" }}>
                      <CheckCircle size={15} /> Selfie verified & uploaded.
                    </p>
                  )}
                </div>

                {/* 2. AUDIO CONVERSATION RECORDING */}
                <div style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "16px", background: "#f8fafc" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>
                    2. Conversation Audio Recording
                  </h3>

                  {isRecording ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px", background: "#fff", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--red)", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                        <strong style={{ color: "var(--red)" }}>Recording conversation…</strong>
                        <span style={{ fontFamily: "monospace", fontSize: "15px", fontWeight: "700" }}>{formatDuration(recordingSeconds)}</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                        Microphone is actively recording. Click stop when the customer discussion concludes.
                      </p>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ color: "var(--red)", borderColor: "var(--red)", alignSelf: "flex-start" }}
                        onClick={stopRecording}
                      >
                        <Square size={16} /> Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={busy || isRecording}
                          onClick={startRecording}
                        >
                          <Mic size={16} /> Start Microphone Recording
                        </button>
                        {audioPreviewUrl && (
                          <span style={{ fontSize: "13px", color: "var(--green)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle size={14} /> Ready ({formatDuration(recordingSeconds)})
                          </span>
                        )}
                      </div>

                      {audioPreviewUrl && (
                        <div style={{ marginTop: "6px" }}>
                          <audio controls src={audioPreviewUrl} style={{ width: "100%", height: "40px" }} />
                        </div>
                      )}

                      {/* Fallback File Upload */}
                      <details style={{ marginTop: "8px", fontSize: "13px" }}>
                        <summary style={{ cursor: "pointer", color: "var(--muted)", fontWeight: "600" }}>
                          Or choose audio file from device (fallback)
                        </summary>
                        <div style={{ marginTop: "8px" }}>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={e => {
                              const f = e.target.files?.[0] || null
                              setAudio(f)
                              if (f) {
                                if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
                                setAudioPreviewUrl(URL.createObjectURL(f))
                              }
                            }}
                          />
                        </div>
                      </details>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy || !audio}
                        onClick={() => upload("audio")}
                        style={{ marginTop: "8px", alignSelf: "flex-start" }}
                      >
                        <Upload size={16} />{busy === "audio" ? "Uploading audio…" : "Upload Audio Evidence"}
                      </button>
                      {audioUploaded && (
                        <p className="toast-message" style={{ marginTop: "8px" }}>
                          <CheckCircle size={15} /> Audio recording uploaded.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <p className="muted" style={{ fontSize: "12px" }}>
                  Note: Audio recording runs in the browser foreground. Background recording when browser is closed or phone is locked is not supported on web.
                </p>

                <button
                  type="button"
                  className="success-button"
                  disabled={busy || !selfieUploaded}
                  onClick={submit}
                  style={{ marginTop: "12px", minHeight: "44px" }}
                >
                  {busy === "submit" ? "Submitting visit…" : "Complete & Submit Visit"}
                </button>
              </>
            )}

            {visit.status === "IN_PROGRESS" && visit.verificationResult === "FAILED" && (
              <p className="inline-warning">Arrival verification failed. This visit cannot be submitted from this location.</p>
            )}
            {visit.status === "PENDING_REVIEW" && (
              <p className="toast-message">Visit submitted and pending review by manager.</p>
            )}
            {visit.status === "COMPLETED" && (
              <p className="toast-message">Visit approved.</p>
            )}
            {visit.status === "REJECTED" && (
              <p className="inline-warning">Visit rejected: {visit.rejectionReason || "Review with manager."}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Schedules({ history = false }) {
  const [state, setState] = useState({ loading: true, error: "", schedules: [] })
  const [selected, setSelected] = useState(null)
  const [documents, setDocuments] = useState(null)
  const [calls, setCalls] = useState(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: "" }))
    try {
      const data = await outsideSalesApi.listVisitSchedules({ page: 1, pageSize: 100 })
      setState({ loading: false, error: "", schedules: data.schedules || [] })
    } catch (e) {
      setState({ loading: false, error: messageFor(e), schedules: [] })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() =>
    history
      ? state.schedules.filter(s => s.visit?.status === "PENDING_REVIEW" || s.visit?.status === "COMPLETED" || s.visit?.status === "REJECTED")
      : state.schedules,
    [history, state.schedules]
  )

  function changed(id, visit) {
    setState(s => ({
      ...s,
      schedules: s.schedules.map(item => item.id === id ? { ...item, visit } : item)
    }))
  }

  if (state.loading) return <div className="empty-state"><h3>Loading assigned visits…</h3></div>
  if (state.error) return <Failure error={state.error} retry={load} />

  return (
    <>
      <section className="card data-page-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Property</th>
                <th>Scheduled</th>
                <th>Visit status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(schedule => (
                <tr key={schedule.id}>
                  <td data-label="Customer">
                    <strong>{schedule.customer?.fullName || `Customer #${schedule.customerId}`}</strong>
                    <span>{schedule.customer?.phone || "—"}</span>
                  </td>
                  <td data-label="Property">{schedule.property?.title || `Property #${schedule.propertyId}`}</td>
                  <td data-label="Scheduled">{formatDateTime(schedule.scheduledAt)}</td>
                  <td data-label="Visit Status">
                    <span className={`status-badge ${
                      schedule.visit?.status === "COMPLETED" ? "status-completed" :
                      schedule.visit?.status === "REJECTED" ? "status-rejected" :
                      schedule.visit?.status === "PENDING_REVIEW" ? "status-pending" :
                      "status-scheduled"
                    }`}>
                      {statusLabel(schedule.visit)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="table-actions">
                      <button className="primary-button" onClick={() => setSelected(schedule)}>
                        {schedule.visit ? "Visit Evidence" : "Reached location"}
                      </button>
                      <button className="secondary-button" onClick={() => setDocuments(schedule)}>
                        Documents
                      </button>
                      <button className="secondary-button" onClick={() => setCalls(schedule)}>
                        Call outcomes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty-state">
            <h3>No visits scheduled</h3>
            <p>A visit will appear here after an interested customer is scheduled.</p>
          </div>
        )}
      </section>

      {selected && <VisitWorkflow schedule={selected} onChange={changed} onClose={() => setSelected(null)} />}
      {documents && (
        <div className="modal-backdrop" onClick={() => setDocuments(null)}>
          <div className="modal" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setDocuments(null)} aria-label="Close"><X /></button>
            <PropertyDocuments propertyId={documents.propertyId} role="OUTSIDE_SALES" onClose={() => setDocuments(null)} />
          </div>
        </div>
      )}
      {calls && (
        <div className="modal-backdrop" onClick={() => setCalls(null)}>
          <div className="modal" style={{ maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setCalls(null)} aria-label="Close"><X /></button>
            <CustomerCallLogs customerId={calls.customerId} role="OUTSIDE_SALES" />
          </div>
        </div>
      )}
    </>
  )
}

export default function OutsideSalesWorkspace() {
  const { section = "overview" } = useParams()
  const { user } = useAuth()
  const label = nav.find(([id]) => id === section)?.[1] || "Today's Visits"

  let body = section === "visits" ? <Schedules history />
    : section === "customers" ? <Schedules />
    : section === "attendance" ? <EmployeeAttendance />
    : section === "announcements" ? <AnnouncementList role="OUTSIDE_SALES" />
    : section === "profile" ? (
      <section className="card entity-form" style={{ maxWidth: "600px" }}>
        <div className="drawer-profile">
          <div className="avatar large">{(user?.name || "U").slice(0, 1)}</div>
          <h2>{user?.name || "Outside Sales Representative"}</h2>
          <p>Outside Sales Representative</p>
        </div>
        <div className="detail-row"><div><span>Email</span><strong>{user?.email}</strong></div></div>
      </section>
    ) : <Schedules />

  return (
    <Shell section={section}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OUTSIDE SALES</span>
          <h1>{label}</h1>
          <p>Live visit assignments and evidence workflow.</p>
        </div>
      </div>
      {body}
    </Shell>
  )
}
