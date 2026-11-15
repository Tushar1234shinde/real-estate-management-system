import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router"
import { Building2, Contact, Home, Plus, Settings, UserCheck, UserPlus, Users, Clock3, Phone, X, MapPin, Menu, Camera, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from "lucide-react"
import { useAuth } from "../auth/AuthContext.jsx"
import { adminApi } from "../api/admin.js"
import { executiveApi } from "../api/executive.js"
import { propertiesApi } from "../api/properties.js"
import { enumLabel, mapCustomerForDisplay, mapEmployeeForDisplay, mapPropertyForDisplay, toNumericId } from "../utils/apiMappers.js"
import { PropertyDocuments } from "../components/PropertyDocuments.jsx"
import { AdminAttendance } from "../components/AdminAttendance.jsx"
import { AdminCallLogs } from "../components/AdminCallLogs.jsx"
import { CustomerWhatsApp } from "../components/CustomerWhatsApp.jsx"
import { AdminOfficeLocations } from "../components/AdminOfficeLocations.jsx"
import { AnnouncementList } from "../components/AnnouncementList.jsx"
import { AnnouncementForm } from "../components/AnnouncementForm.jsx"
import { AnnouncementStats } from "../components/AnnouncementStats.jsx"
import { AdminVisitReview } from "../components/AdminVisitReview.jsx"
import { announcementsApi } from "../api/announcements.js"

const employeeRoles = ["ADMIN", "EXECUTIVE", "INSIDE_SALES", "OUTSIDE_SALES"]
const customerStatuses = ["NEW", "ASSIGNED", "CONTACTED", "CONVERTED", "CLOSED"]
const interestStatuses = ["PENDING", "INTERESTED", "NOT_INTERESTED"]
const propertyStatuses = ["AVAILABLE", "BOOKED", "SOLD", "INACTIVE"]
const sectionModalType = {
  employees: "employee",
  customers: "customer",
  properties: "property",
}

function messageFor(error) {
  return error?.message || "The request could not be completed."
}

function initials(name) {
  return String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error("File must contain a header row and at least one data row.")
  const separator = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ","
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase())
  const nameIdx = headers.findIndex(h => h.includes("name"))
  const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("contact"))
  const emailIdx = headers.findIndex(h => h.includes("email"))
  const addrIdx = headers.findIndex(h => h.includes("address") || h.includes("location") || h.includes("city"))
  const interestIdx = headers.findIndex(h => h.includes("interest"))
  if (nameIdx === -1 || phoneIdx === -1) {
    throw new Error("File header row must include at least 'Name' (or 'fullName') and 'Phone' columns.")
  }
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""))
    if (cols.length <= Math.max(nameIdx, phoneIdx)) continue
    const fullName = cols[nameIdx] || ""
    const phone = cols[phoneIdx] || ""
    const email = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : null
    const address = addrIdx !== -1 && cols[addrIdx] ? cols[addrIdx] : null
    let interestStatus = "PENDING"
    if (interestIdx !== -1 && cols[interestIdx]) {
      const rawInt = cols[interestIdx].toUpperCase()
      if (rawInt.includes("NOT") || rawInt === "NOT_INTERESTED") interestStatus = "NOT_INTERESTED"
      else if (rawInt.includes("INT") || rawInt === "INTERESTED") interestStatus = "INTERESTED"
    }
    if (fullName && phone) {
      rows.push({ fullName, phone, email, address, interestStatus })
    }
  }
  return rows
}

function Shell({ role, profile, isAdmin, children }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const links = [
    ["overview", "Overview", Home],
    ["employees", "Employee Management", Users],
    ["customers", "Customer Management", Contact],
    ["assignments", "Customer Assignments", UserCheck],
    ["properties", "Properties", Building2],
    ["reviews", "Visit Reviews", Camera],
    ["calls", "Call Records", Phone],
    ["announcements", "Announcements", Clock3],
    ...(isAdmin ? [["office-locations", "Office Locations", MapPin], ["attendance", "Attendance", Clock3]] : []),
    ["profile", "My Profile", Settings],
  ]
  const [open, setOpen] = useState(false)
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="app-logo"><img src="/proplattice-logo.png" alt="PropLattice" /><div>PROPLATTICE<small>REAL ESTATE, IN SYNC</small></div></div>
          <button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
        </div>
        <nav aria-label="Workspace navigation"><span className="nav-heading">WORKSPACE</span>{links.map(([id, label, Icon]) => <NavLink key={id} to={`/app/${role}/${id}`} onClick={() => setOpen(false)}><Icon /><span>{id === "employees" && role === "executive" ? "Employee List" : label}</span></NavLink>)}</nav>
        <div className="sidebar-user"><div className="avatar">{initials(profile?.fullName)}</div><div><strong>{profile?.fullName || "Loading profile"}</strong><small>{role === "admin" ? "Administrator" : "Executive"}</small></div></div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="app-logo topbar-brand"><img src="/proplattice-logo.png" alt="PropLattice" /><span>PROPLATTICE</span></div>
          <div className="top-actions">
            <button className="icon-button menu-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
            <button className="text-button" onClick={() => { signOut(); navigate("/", { replace: true }) }}>Log out</button>
            <div className="header-profile"><div className="avatar">{initials(profile?.fullName)}</div><span><strong>{profile?.fullName || "Account"}</strong><small>{role === "admin" ? "Admin" : "Executive"}</small></span></div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

function Notice({ error, success }) { return <>{error && <div className="inline-warning" role="alert">{error}</div>}{success && <div className="toast-message" role="status">{success}</div>}</> }
function Loading({ label = "Loading records…" }) { return <div className="card empty-state"><h3>{label}</h3></div> }
function Pager({ pagination, setPage }) { if (!pagination) return null; return <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} records</span><div><button className="secondary-button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button> <button className="secondary-button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></div> }

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleBackdropClick() {
    onClose();
  }

  function handleCardClick(event) {
    event.stopPropagation();
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="modal-backdrop" onClick={handleBackdropClick}>
        <div className="modal-card" onClick={handleCardClick}>
          <div className="modal-head">
            <div><span>OPERATIONS</span><h2>{title}</h2></div>
            <button className="icon-button" onClick={onClose}><X /></button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
function Field({ label, children }) { return <label className="field-label">{label}{children}</label> }

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function ProfilePhotoUpload({ initialUrl, onImageUrl, uploadApi }) {
  const [preview, setPreview] = useState(initialUrl || null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef(null);

  function handleFileChange(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setUploadError("Only JPG, PNG and WebP images are accepted.");
      return;
    }
    if (selected.size > PROFILE_IMAGE_MAX_BYTES) {
      setUploadError("Image must be 5 MB or smaller.");
      return;
    }
    setUploadError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    onImageUrl(null); // reset URL — will be set after upload
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadApi(file);
      onImageUrl(result.imageUrl);
      setUploadError("");
    } catch (e) {
      setUploadError(e?.message || "Image upload failed.");
      onImageUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setFile(null);
    setUploadError("");
    onImageUrl(null);
  }

  return (
    <div className="profile-photo-upload">
      <div className="profile-photo-preview">
        {preview
          ? <img src={preview} alt="Profile preview" className="avatar large" style={{ objectFit: "cover", borderRadius: "50%" }} />
          : <div className="avatar large" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>?</div>
        }
      </div>
      <div className="profile-photo-actions">
        <input
          ref={inputRef}
          type="file"
          accept={PROFILE_IMAGE_ACCEPT}
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-label="Choose profile photo"
        />
        <button type="button" className="secondary-button" onClick={() => inputRef.current?.click()}>
          {preview ? "Change photo" : "Choose photo"}
        </button>
        {file && !uploading && (
          <button type="button" className="primary-button" onClick={handleUpload}>Upload</button>
        )}
        {uploading && <span className="muted">Uploading…</span>}
        {preview && !uploading && (
          <button type="button" className="text-button" onClick={handleRemove}>Remove</button>
        )}
        {uploadError && <p className="field-error">{uploadError}</p>}
        {!uploadError && file && !uploading && <p className="muted" style={{ fontSize: "0.78rem" }}>Click "Upload" to save the photo.</p>}
      </div>
    </div>
  );
}

function EmployeeForm({ role, record, onSave, onClose, uploadApi }) {
  const [error, setError] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState(record?.profileImageUrl || null);
  const executive = role === "executive";

  async function submit(event) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const body = { fullName: raw.fullName, phone: raw.phone || null, profileImageUrl: profileImageUrl || null };
    if (!record) Object.assign(body, { email: raw.email, password: raw.password, role: raw.role });
    else if (!executive) Object.assign(body, { email: raw.email, ...(raw.password ? { password: raw.password } : {}), role: raw.role });
    try { await onSave(body); onClose(); } catch (e) { setError(messageFor(e)); }
  }

  const allowedRoles = executive ? ["INSIDE_SALES", "OUTSIDE_SALES"] : employeeRoles;

  return (
    <Dialog title={record ? "Edit employee" : "Add employee"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Full name *"><input name="fullName" required defaultValue={record?.fullName} /></Field>
          {(!record || !executive) && <Field label="Email *"><input name="email" type="email" required defaultValue={record?.email} /></Field>}
          {!record && <Field label="Password *"><input name="password" type="password" minLength="8" required /></Field>}
          {record && !executive && <Field label="New password (optional)"><input name="password" type="password" minLength="8" /></Field>}
          {!record && <Field label="Role *"><select name="role" required defaultValue=""><option value="">Select role</option>{allowedRoles.map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>}
          {record && !executive && <Field label="Role *"><select name="role" required defaultValue={record.role?.name || record.role}><option value="">Select role</option>{allowedRoles.map((value) => <option key={value} value={value}>{enumLabel(value)}</option>)}</select></Field>}
          <Field label="Phone"><input name="phone" placeholder="+919876543210" defaultValue={record?.phone || ""} /></Field>
          <div className="field-label">
            <span>Profile photo (optional)</span>
            {uploadApi
              ? <ProfilePhotoUpload initialUrl={record?.profileImageUrl} onImageUrl={setProfileImageUrl} uploadApi={uploadApi} />
              : <p className="field-error" style={{ marginTop: "6px" }}>Profile image upload is not configured. Contact the system administrator to set up Cloudinary.</p>
            }
          </div>
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button">{record ? "Save changes" : "Create employee"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function CustomerForm({ record, onSave, onImport, onClose }) {
  const [error, setError] = useState("")
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [fileData, setFileData] = useState(null)
  const [fileName, setFileName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [importSummary, setImportSummary] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const raw = Object.fromEntries(new FormData(e.currentTarget))
    const body = {
      fullName: raw.fullName,
      phone: raw.phone,
      email: raw.email || null,
      address: raw.address || null,
      status: record ? raw.status : "NEW",
      interestStatus: raw.interestStatus
    }
    try {
      await onSave(body)
      onClose()
    } catch (err) {
      setError(messageFor(err))
    }
  }

  function handleFileSelect(e) {
    setError("")
    setImportSummary(null)
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      setError("Direct binary Excel (.xlsx/.xls) files cannot be read in the browser. Please open your spreadsheet in Microsoft Excel or Google Sheets and save it as CSV (File > Save As > CSV), then upload the CSV file here.")
      setFileData(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        if (typeof text !== "string") throw new Error("Could not read file text.")
        const rows = parseCsvText(text)
        if (rows.length === 0) throw new Error("No valid data rows found in file.")
        setFileData(rows)
      } catch (err) {
        setError(err.message || "Failed to parse file.")
        setFileData(null)
      }
    }
    reader.readAsText(file)
  }

  async function handleBulkImport() {
    if (!fileData || fileData.length === 0) return
    setUploading(true)
    setError("")
    try {
      const res = await onImport(fileData)
      setImportSummary(res)
    } catch (err) {
      const data = err?.data
      if (data?.errors) {
        setError(`Import rejected: ${data.errors.length} validation errors found. No data was inserted.`)
        setImportSummary(data)
      } else {
        setError(messageFor(err))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog title={record ? "Edit customer" : isBulkMode ? "Upload Customer Excel / CSV" : "Add customer"} onClose={onClose}>
      {isBulkMode ? (
        <div className="entity-form">
          <p className="muted" style={{ marginBottom: "14px" }}>
            Upload an Excel-exported CSV file containing columns: <code>Name</code>, <code>Phone</code>, <code>Email</code> (optional), <code>Address</code> (optional), <code>Interest</code> (optional).
          </p>

          <label className="field-label">
            Choose CSV or Excel export
            <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFileSelect} />
          </label>

          {fileData && (
            <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <strong>{fileData.length} valid customer rows parsed from {fileName}</strong>
              <div style={{ maxHeight: "140px", overflowY: "auto", fontSize: "12px", marginTop: "6px" }}>
                {fileData.slice(0, 5).map((row, idx) => (
                  <div key={idx} style={{ padding: "3px 0", borderBottom: "1px solid #edf2f7" }}>
                    #{idx + 1} {row.fullName} · {row.phone} · {row.email || "No email"}
                  </div>
                ))}
                {fileData.length > 5 && <p className="muted">… and {fileData.length - 5} more rows.</p>}
              </div>
            </div>
          )}

          {error && <p className="field-error" style={{ marginTop: "10px" }}>{error}</p>}

          {importSummary?.errors && importSummary.errors.length > 0 && (
            <div style={{ marginTop: "12px", padding: "10px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <strong style={{ color: "var(--red)", fontSize: "13px" }}>Row Errors:</strong>
              <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: "12px", marginTop: "4px" }}>
                {importSummary.errors.map((errItem, idx) => (
                  <div key={idx} style={{ color: "var(--red)", padding: "2px 0" }}>
                    • {errItem.row ? `Row ${errItem.row}: ` : ""}{errItem.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importSummary?.importedCount && (
            <div style={{ marginTop: "12px", padding: "10px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", color: "var(--green)" }}>
              <strong>✓ Successfully imported {importSummary.importedCount} customers!</strong>
            </div>
          )}

          <div className="form-footer" style={{ marginTop: "16px" }}>
            <button type="button" className="secondary-button" onClick={() => setIsBulkMode(false)}>
              Back to Single Entry
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={uploading || !fileData || fileData.length === 0}
              onClick={handleBulkImport}
            >
              {uploading ? "Importing…" : "Upload & Insert Customers"}
            </button>
          </div>
        </div>
      ) : (
        <form className="entity-form" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Full name *"><input name="fullName" required defaultValue={record?.fullName} /></Field>
            <Field label="Phone *"><input name="phone" required placeholder="+919876543210" defaultValue={record?.phone} /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={record?.email || ""} /></Field>
            <Field label="Address"><input name="address" defaultValue={record?.address || ""} /></Field>
            {record && (
              <Field label="Customer status *">
                <select name="status" defaultValue={record.status}>
                  {customerStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            )}
            <Field label="Interest status *">
              <select name="interestStatus" defaultValue={record?.interestStatus || "PENDING"}>
                {interestStatuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {!record && (
            <p className="muted">
              New customers start as NEW. Assignment is a separate, permanent action after creation.
            </p>
          )}

          {error && <p className="field-error">{error}</p>}

          <div className="form-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
            {!record ? (
              <button
                type="button"
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => { setError(""); setIsBulkMode(true); }}
              >
                <FileSpreadsheet size={16} /> Upload Excel
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button">{record ? "Save changes" : "Submit"}</button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  )
}

function PropertyForm({ record, onSave, onClose }) {
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const number = (v) => v === "" ? undefined : Number(v);
    const body = {
      title: raw.title,
      location: raw.location,
      price: raw.price,
      description: raw.description || null,
      status: raw.status,
      latitude: number(raw.latitude),
      longitude: number(raw.longitude),
      verificationRadiusMeters: raw.verificationRadiusMeters === "" ? undefined : Number(raw.verificationRadiusMeters)
    };
    if (body.latitude === undefined && body.longitude === undefined) {
      delete body.latitude;
      delete body.longitude;
    }
    try {
      await onSave(body);
      onClose();
    } catch (err) {
      setError(messageFor(err));
    }
  }
  return (
    <Dialog title={record ? "Edit property" : "Add property"} onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Title *"><input name="title" required defaultValue={record?.title} /></Field>
          <Field label="Location *"><input name="location" required defaultValue={record?.location} /></Field>
          <Field label="Price *"><input name="price" required inputMode="decimal" defaultValue={record?.price} /></Field>
          <Field label="Availability *">
            <select name="status" defaultValue={record?.status || "AVAILABLE"}>
              {propertyStatuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Latitude"><input name="latitude" type="number" step="any" defaultValue={record?.latitude ?? ""} /></Field>
          <Field label="Longitude"><input name="longitude" type="number" step="any" defaultValue={record?.longitude ?? ""} /></Field>
          <Field label="Verification radius (metres)"><input name="verificationRadiusMeters" type="number" min="1" step="1" defaultValue={record?.verificationRadiusMeters ?? ""} /></Field>
          <Field label="Description"><textarea name="description" defaultValue={record?.description || ""} /></Field>
        </div>
        <p className="muted">Coordinates and verification radius are preserved for location verification.</p>
        {error && <p className="field-error">{error}</p>}
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button">{record ? "Save changes" : "Create property"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function Overview({ dashboard, profile }) {
  if (!dashboard) return <Loading label="Loading dashboard…" />;
  const cards = [
    ["Employees", dashboard.employees?.total],
    ["Customers", dashboard.customers?.total],
    ["Properties", dashboard.properties?.total],
    ["Unassigned customers", dashboard.customers?.unassigned],
    ["Pending visit reviews", dashboard.visits?.byStatus?.PENDING_REVIEW || 0]
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUSINESS OVERVIEW</span>
          <h1>Welcome, {profile?.fullName?.split(" ")[0] || "there"}</h1>
          <p>Live operational data from the management API.</p>
        </div>
      </div>
      <div className="stats-grid">
        {cards.map(([label, value], i) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon ${["blue", "purple", "cyan", "orange", "green"][i]}`}><Building2 /></div>
            <div className="stat-copy"><span>{label}</span><strong>{value ?? 0}</strong></div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card performance-card">
          <h3>Customer pipeline</h3>
          {Object.entries(dashboard.customers?.byStatus || {}).map(([key, value]) => (
            <div className="pipeline-list" key={key}><div><span>{enumLabel(key)}</span><strong>{value}</strong></div></div>
          ))}
        </section>
        <section className="card performance-card">
          <h3>Property availability</h3>
          {Object.entries(dashboard.properties?.byStatus || {}).map(([key, value]) => (
            <div className="pipeline-list" key={key}><div><span>{enumLabel(key)}</span><strong>{value}</strong></div></div>
          ))}
        </section>
      </div>
    </>
  );
}

export default function AdminExecutiveWorkspace() {
  const { user } = useAuth();
  const { section = "overview" } = useParams();
  const role = user?.role === "ADMIN" ? "admin" : "executive";
  const isAdmin = role === "admin";
  const [profile, setProfile] = useState(null),
    [dashboard, setDashboard] = useState(null),
    [rows, setRows] = useState([]),
    [pagination, setPagination] = useState(null),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [documentProperty, setDocumentProperty] = useState(null),
    [insideSales, setInsideSales] = useState([]),
    [whatsappCustomer, setWhatsappCustomer] = useState(null),
    [announcementRefreshKey, setAnnouncementRefreshKey] = useState(0),
    [announcementStatsId, setAnnouncementStatsId] = useState(null);

  const api = isAdmin ? adminApi : executiveApi;

  const loadProfileDashboard = useCallback(async () => {
    try {
      const [profileData, dashboardData] = await Promise.all([adminApi.getProfile(), adminApi.getDashboard()]);
      setProfile(profileData.profile);
      setDashboard(dashboardData);
    } catch (e) {
      setError(messageFor(e));
    }
  }, []);

  const loadRows = useCallback(async () => {
    if (["overview", "profile", "office-locations", "attendance", "calls", "announcements", "reviews"].includes(section)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (section === "properties") {
        const data = await propertiesApi.list({ page, pageSize: 20 });
        setRows(data.properties.map(mapPropertyForDisplay));
        setPagination(data.pagination);
      } else if (section === "employees") {
        const data = await api.listEmployees({ page, pageSize: 20 });
        setRows(data.employees.map(mapEmployeeForDisplay));
        setPagination(data.pagination);
      } else {
        const data = await api.listCustomers({ page, pageSize: 20 });
        setRows(data.customers.map(mapCustomerForDisplay));
        setPagination(data.pagination);
      }
    } catch (e) {
      setError(messageFor(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, page, section]);

  useEffect(() => { loadProfileDashboard() }, [loadProfileDashboard]);
  useEffect(() => { setPage(1) }, [section]);
  useEffect(() => { loadRows() }, [loadRows]);

  useEffect(() => {
    if (section === "assignments") {
      api.listEmployees({ page: 1, pageSize: 100, isActive: true })
        .then(d => setInsideSales(d.employees.filter(e => (e.role?.name || e.role) === "INSIDE_SALES").map(mapEmployeeForDisplay)))
        .catch(e => setError(messageFor(e)));
    }
  }, [api, section]);

  async function saveEmployee(body) {
    const data = modal?.record ? await adminApi.updateEmployee(toNumericId(modal.record.id), body) : await api.createEmployee(body);
    setSuccess(`Employee ${modal?.record ? "updated" : "created"}.`);
    await loadRows();
    return data;
  }

  async function saveCustomer(body) {
    const data = modal?.record ? await adminApi.updateCustomer(toNumericId(modal.record.id), body) : await api.createCustomer(body);
    setSuccess(`Customer ${modal?.record ? "updated" : "created"}.`);
    await loadRows();
    await loadProfileDashboard();
    return data;
  }

  async function importCustomerBatch(customers) {
    const res = await api.importCustomers(customers);
    setSuccess(res.message || "Customers successfully imported.");
    await loadRows();
    await loadProfileDashboard();
    return res.data || res;
  }

  async function saveProperty(body) {
    const data = modal?.record ? await propertiesApi.update(toNumericId(modal.record.id), body) : await propertiesApi.create(body);
    setSuccess(`Property ${modal?.record ? "updated" : "created"}.`);
    await loadRows();
    return data;
  }

  async function assign(customerId, employeeId) {
    try {
      if (!Number.isSafeInteger(customerId) || !Number.isSafeInteger(employeeId)) {
        throw new Error("A valid customer and Inside Sales employee are required.");
      }
      if (isAdmin) await adminApi.assignCustomer(customerId, employeeId);
      else await executiveApi.assignCustomer(customerId, employeeId);
      setSuccess("Customer permanently assigned to Inside Sales.");
      setSelected(null);
      await loadRows();
      await loadProfileDashboard();
    } catch (e) {
      setError(messageFor(e));
    }
  }

  async function toggleStatus(record) {
    try {
      await adminApi.updateEmployeeStatus(toNumericId(record.id), !record.isActive);
      setSuccess("Employee activation status updated.");
      await loadRows();
    } catch (e) {
      setError(messageFor(e));
    }
  }

  const title = {
    overview: "Overview",
    employees: "Employee Management",
    customers: "Customer Management",
    assignments: "Customer Assignments",
    properties: "Properties",
    reviews: "Visit Reviews",
    calls: "Call Records",
    announcements: "Announcements",
    "office-locations": "Office Locations",
    attendance: "Attendance Reports",
    profile: "My Profile"
  }[section] || "Overview";

  let body;
  if (section === "overview") body = <Overview dashboard={dashboard} profile={profile} />;
  else if (section === "profile") body = profile ? (
    <section className="card entity-form">
      <div className="drawer-profile">
        <div className="avatar large">{initials(profile.fullName)}</div>
        <h2>{profile.fullName}</h2>
        <p>{enumLabel(profile.role)}</p>
      </div>
      <div className="detail-row"><div><span>Email</span><strong>{profile.email}</strong></div></div>
      <div className="detail-row"><div><span>Phone</span><strong>{profile.phone || "Not provided"}</strong></div></div>
    </section>
  ) : <Loading label="Loading profile…" />;
  else if (section === "calls") body = <AdminCallLogs role={role} />;
  else if (section === "announcements") body = (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEAM COMMUNICATION</span>
          <h1>Announcements</h1>
          <p>Create in-app updates and holiday notices.</p>
        </div>
        <button className="primary-button" onClick={() => setModal({ type: "announcement" })}><Plus /> Add announcement</button>
      </div>
      <AnnouncementList
        key={announcementRefreshKey}
        role={user?.role}
        onEdit={(announcement) => setModal({ type: "announcement", record: announcement })}
        onDelete={async (id) => { await announcementsApi.remove(id); setSuccess("Announcement deleted.") }}
        onStats={(announcement) => setAnnouncementStatsId(announcement.id)}
      />
    </>
  );
  else if (section === "office-locations") body = isAdmin ? <AdminOfficeLocations /> : <div className="card empty-state"><h3>Restricted</h3><p>Office location management is restricted to Administrators.</p></div>;
  else if (section === "attendance") body = isAdmin ? <AdminAttendance /> : <div className="card empty-state"><h3>Restricted</h3><p>Organization attendance reports are restricted to Administrators.</p></div>;
  else if (section === "reviews") body = <AdminVisitReview onReviewComplete={loadProfileDashboard} />;
  else body = (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{role.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>{section === "assignments" ? "Assignments are permanent and cannot be reassigned." : "Live records from the management API."}</p>
        </div>
        {["employees", "customers", "properties"].includes(section) && (
          <button className="primary-button" onClick={() => setModal({ type: sectionModalType[section] })}>
            <Plus /> Add {sectionModalType[section]}
          </button>
        )}
      </div>
      <section className="card data-page-card">
        {loading ? <Loading /> : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {section === "employees" ? (
                    <><th>Employee</th><th>Role</th><th>Status</th><th /></>
                  ) : section === "properties" ? (
                    <><th>Property</th><th>Location</th><th>Price</th><th>Availability</th><th /></>
                  ) : (
                    <><th>Customer</th><th>Phone</th><th>Status</th><th>Assignment</th><th /></>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    {section === "employees" ? (
                      <>
                        <td data-label="Employee"><div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>{row.profileImageUrl ? <img src={row.profileImageUrl} alt="" className="avatar" style={{ objectFit: "cover", borderRadius: "50%", flexShrink: 0 }} /> : <div className="avatar" style={{ flexShrink: 0 }}>{initials(row.fullName)}</div>}<div><strong>{row.fullName}</strong><span>{row.email}</span></div></div></td>
                        <td data-label="Role">{enumLabel(row.role?.name || row.role)}</td>
                        <td data-label="Status"><span className={`status-badge ${row.isActive ? "status-active" : "status-inactive"}`}>{row.isActive ? "Active" : "Inactive"}</span></td>
                        <td data-label="Actions"><div className="table-actions">
                          <button className="secondary-button" onClick={() => setModal({ type: "employee", record: row })}>Details / edit</button>
                          {isAdmin && <button className="text-button" onClick={() => toggleStatus(row)}>{row.isActive ? "Deactivate" : "Activate"}</button>}
                        </div></td>
                      </>
                    ) : section === "properties" ? (
                      <>
                        <td data-label="Property"><strong>{row.title}</strong><span>{row.description || "No description"}</span></td>
                        <td data-label="Location">{row.location}</td>
                        <td data-label="Price">{row.price}</td>
                        <td data-label="Availability"><span className={`status-badge ${row.status === "AVAILABLE" ? "status-available" : row.status === "SOLD" ? "status-inactive" : "status-pending"}`}>{enumLabel(row.status)}</span></td>
                        <td data-label="Actions"><div className="table-actions">
                          <button className="secondary-button" onClick={() => setModal({ type: "property", record: row })}>Details / edit</button>
                          <button className="text-button" onClick={() => { setDocumentProperty(row); setModal(null) }}>Documents</button>
                        </div></td>
                      </>
                    ) : (
                      <>
                        <td data-label="Customer"><strong>{row.fullName}</strong><span>{row.email || "No email"}</span></td>
                        <td data-label="Phone">{row.phone}</td>
                        <td data-label="Status">
                          <span className={`status-badge ${row.status === "ACTIVE" ? "status-active" : "status-inactive"}`}>{enumLabel(row.status)}</span>
                          {" "}
                          <span className={`status-badge ${row.interestStatus === "INTERESTED" ? "status-interested" : row.interestStatus === "NOT_INTERESTED" ? "status-not-interested" : "status-pending"}`}>{enumLabel(row.interestStatus)}</span>
                        </td>
                        <td data-label="Assignment">{row.assignment ? `Inside Sales #${row.assignment.insideSalesEmployeeId}` : "Unassigned"}</td>
                        <td data-label="Actions"><div className="table-actions">
                          <button className="secondary-button" onClick={() => setModal({ type: "customer", record: row })}>Details / edit</button>
                          <button className="text-button" onClick={() => { setModal(null); setWhatsappCustomer(row); }}>WhatsApp</button>
                          {section === "assignments" && !row.assignment && <button className="text-button" onClick={() => setSelected(row)}>Assign</button>}
                        </div></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div className="empty-state"><h3>No records found</h3><p>There are no matching records on this page.</p></div>}
          </div>
        )}
        <Pager pagination={pagination} setPage={setPage} />
      </section>
    </>
  );

  return (
    <Shell role={role} profile={profile} isAdmin={isAdmin}>
      <Notice error={error} success={success} />
      {body}
      {modal?.type === "employee" && (
        <EmployeeForm role={role} record={modal.record} onSave={saveEmployee} onClose={() => setModal(null)} uploadApi={api.uploadEmployeeProfileImage ?? adminApi.uploadEmployeeProfileImage} />
      )}
      {modal?.type === "customer" && (
        <CustomerForm
          record={modal.record}
          onSave={saveCustomer}
          onImport={importCustomerBatch}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "property" && (
        <PropertyForm record={modal.record} onSave={saveProperty} onClose={() => setModal(null)} />
      )}
      {modal?.type === "announcement" && (
        <Dialog title={modal.record ? "Edit announcement" : "Add announcement"} onClose={() => setModal(null)}>
          <AnnouncementForm
            announcement={modal.record}
            onClose={() => setModal(null)}
            onSave={() => {
              setSuccess(`Announcement ${modal.record ? "updated" : "created"}.`);
              setAnnouncementRefreshKey((key) => key + 1);
              setModal(null);
            }}
          />
        </Dialog>
      )}
      {announcementStatsId && (
        <Dialog title="Announcement reads" onClose={() => setAnnouncementStatsId(null)}>
          <AnnouncementStats announcementId={announcementStatsId} onClose={() => setAnnouncementStatsId(null)} />
        </Dialog>
      )}
      {documentProperty && (
        <Dialog title={`Documents · ${documentProperty.title}`} onClose={() => setDocumentProperty(null)}>
          <PropertyDocuments propertyId={documentProperty.id} role={user?.role} user={user} onClose={() => setDocumentProperty(null)} />
        </Dialog>
      )}
      {selected && (
        <Dialog title={`Assign ${selected.fullName}`} onClose={() => setSelected(null)}>
          <div className="entity-form">
            <p className="muted">This assignment is permanent. It cannot be changed or removed.</p>
            <Field label="Active Inside Sales employee">
              <select defaultValue="" onChange={(e) => { const id = toNumericId(e.target.value); if (id) assign(toNumericId(selected.id), id) }}>
                <option value="">Select employee</option>
                {insideSales.map(employee => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.email}</option>)}
              </select>
            </Field>
          </div>
        </Dialog>
      )}
      {whatsappCustomer && (
        <Dialog title={`WhatsApp · ${whatsappCustomer.fullName}`} onClose={() => setWhatsappCustomer(null)}>
          <CustomerWhatsApp
            customerId={whatsappCustomer.id}
            customer={whatsappCustomer}
            interestStatus={whatsappCustomer.interestStatus}
            role={role}
            onClose={() => setWhatsappCustomer(null)}
          />
        </Dialog>
      )}
    </Shell>
  );
}
