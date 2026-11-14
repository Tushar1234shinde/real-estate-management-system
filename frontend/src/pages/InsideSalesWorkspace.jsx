import { useCallback, useEffect, useMemo, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router"
import { CalendarDays, Contact, FileText, Home, Menu, Phone, RefreshCw, UserCheck, Users, X } from "lucide-react"
import { useAuth } from "../auth/AuthContext.jsx"
import { insideSalesApi } from "../api/insideSales.js"
import { enumLabel, formatDateTime } from "../utils/apiMappers.js"
import { CustomerCallLogs } from "../components/CustomerCallLogs.jsx"
import { PropertyDocuments } from "../components/PropertyDocuments.jsx"
import { EmployeeAttendance } from "../components/EmployeeAttendance.jsx"
import { AnnouncementList } from "../components/AnnouncementList.jsx"

const nav = [
  ["overview", "Overview", Home], ["customers", "Assigned Customers", Contact],
  ["interested", "Interested Customers", Users], ["not-interested", "Not Interested", Users],
  ["visits", "Property Visits", CalendarDays], ["calls", "Call Outcomes", Phone],
  ["assignments", "Outside Sales Assignments", UserCheck], ["attendance", "Attendance", CalendarDays],
  ["announcements", "Announcements", FileText], ["profile", "My Profile", Users],
]

function messageFor(error) { return error?.message || "The request could not be completed." }
function Loading({ label = "Loading records…" }) { return <div className="empty-state"><h3>{label}</h3></div> }
function Failure({ message, retry }) { return <div className="empty-state"><h3>Unable to load this page</h3><p>{message}</p><button className="secondary-button" onClick={retry}><RefreshCw size={16} /> Retry</button></div> }
function Empty({ title, text }) { return <div className="empty-state"><h3>{title}</h3><p>{text}</p></div> }

function Shell({ section, children, profile }) {
  const { signOut } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState(false)
  return <div className="app-shell">
    <aside className={`sidebar ${open ? "open" : ""}`}><div className="sidebar-top"><div className="app-logo"><img src="/proplattice-logo.png" alt="PropLattice" /><div>PROPLATTICE<small>REAL ESTATE, IN SYNC</small></div></div><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav aria-label="Workspace navigation"><span className="nav-heading">WORKSPACE</span>{nav.map(([id, label, Icon]) => <NavLink key={id} to={`/app/inside-sales/${id}`} onClick={() => setOpen(false)} className={section === id ? "active" : ""}><Icon /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-user"><div className="avatar">{(profile?.fullName || "U").slice(0, 1)}</div><div><strong>{profile?.fullName || "Inside Sales"}</strong><small>Inside Sales Employee</small></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><div className="top-actions"><button className="text-button" onClick={() => { signOut(); navigate("/") }}>Log out</button></div></header>{children}</main>
  </div>
}

function Customers({ interestStatus, onOpen }) {
  const [state, setState] = useState({ loading: true, error: "", customers: [], pagination: null }); const [page, setPage] = useState(1)
  const load = useCallback(async () => { setState(s => ({ ...s, loading: true, error: "" })); try { const data = await insideSalesApi.listCustomers({ page, pageSize: 50 }); const customers = (data.customers || []).filter(c => !interestStatus || c.interestStatus === interestStatus); setState({ loading: false, error: "", customers, pagination: data.pagination }) } catch (error) { setState({ loading: false, error: messageFor(error), customers: [], pagination: null }) } }, [page, interestStatus])
  useEffect(() => { load() }, [load])
  if (state.loading) return <Loading />; if (state.error) return <Failure message={state.error} retry={load} />
  return <section className="card data-page-card"><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Phone</th><th>Interest</th><th /></tr></thead><tbody>{state.customers.map(customer => <tr key={customer.id}><td><strong>{customer.fullName}</strong><span>{customer.email || "No email"}</span></td><td>{customer.phone || "—"}</td><td>{enumLabel(customer.interestStatus)}</td><td><button className="secondary-button" onClick={() => onOpen(customer)}>Details</button></td></tr>)}</tbody></table></div>{!state.customers.length && <Empty title="No customers found" text="There are no assigned customers in this view." />}{state.pagination?.totalPages > 1 && <div className="pagination"><span>Page {page} of {state.pagination.totalPages}</span><div><button className="secondary-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="secondary-button" disabled={page >= state.pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>}</section>
}

function CustomerDetails({ customer, onClose, refresh }) {
  const [current, setCurrent] = useState(customer); const [saving, setSaving] = useState(false); const [error, setError] = useState("")
  async function updateInterest(interestStatus) { setSaving(true); setError(""); try { const data = await insideSalesApi.updateInterest(current.id, interestStatus); setCurrent(data.customer); refresh() } catch (e) { setError(messageFor(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><div className="modal customer-drawer"><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button><span className="eyebrow">ASSIGNED CUSTOMER</span><h2>{current.fullName}</h2><p>{current.phone || "No phone number"} · {current.email || "No email"}</p>{error && <div className="inline-warning">{error}</div>}<div className="modal-footer"><button className="secondary-button" disabled={saving} onClick={() => updateInterest("INTERESTED")}>Mark Interested</button><button className="secondary-button" disabled={saving} onClick={() => updateInterest("NOT_INTERESTED")}>Mark Not Interested</button></div><CustomerCallLogs customerId={current.id} role="INSIDE_SALES" /></div></div>
}

function Properties() {
  const [state, setState] = useState({ loading: true, error: "", properties: [] }); const [selected, setSelected] = useState(null)
  const load = useCallback(async () => { setState(s => ({ ...s, loading: true, error: "" })); try { const data = await insideSalesApi.listAvailableProperties({ page: 1, pageSize: 100 }); setState({ loading: false, error: "", properties: data.properties || [] }) } catch (e) { setState({ loading: false, error: messageFor(e), properties: [] }) } }, [])
  useEffect(() => { load() }, [load]); if (state.loading) return <Loading label="Loading available properties…" />; if (state.error) return <Failure message={state.error} retry={load} />
  return <><section className="card data-page-card"><div className="table-scroll"><table><thead><tr><th>Property</th><th>Location</th><th>Price</th><th /></tr></thead><tbody>{state.properties.map(property => <tr key={property.id}><td><strong>{property.title}</strong><span>{property.status}</span></td><td>{property.location}</td><td>{property.price}</td><td><button className="secondary-button" onClick={() => setSelected(property)}>Documents</button></td></tr>)}</tbody></table></div>{!state.properties.length && <Empty title="No available properties" text="There are no available properties right now." />}</section>{selected && <div className="modal-backdrop"><div className="modal"><button className="icon-button modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button><PropertyDocuments propertyId={selected.id} role="INSIDE_SALES" onClose={() => setSelected(null)} /></div></div>}</>
}

function Schedules() {
  const [state, setState] = useState({ loading: true, error: "", schedules: [] }); const [showForm, setShowForm] = useState(false); const [saving, setSaving] = useState(false)
  const load = useCallback(async () => { setState(s => ({ ...s, loading: true, error: "" })); try { const data = await insideSalesApi.listVisitSchedules({ page: 1, pageSize: 100 }); setState({ loading: false, error: "", schedules: data.schedules || [] }) } catch (e) { setState({ loading: false, error: messageFor(e), schedules: [] }) } }, [])
  useEffect(() => { load() }, [load]); async function submit(e) { e.preventDefault(); const form = new FormData(e.currentTarget); setSaving(true); try { await insideSalesApi.createVisitSchedule({ customerId: Number(form.get("customerId")), propertyId: Number(form.get("propertyId")), outsideSalesEmployeeId: Number(form.get("outsideSalesEmployeeId")), scheduledAt: new Date(form.get("scheduledAt")).toISOString(), notes: form.get("notes") || undefined }); setShowForm(false); await load() } catch (error) { setState(s => ({ ...s, error: messageFor(error) })) } finally { setSaving(false) } }
  if (state.loading) return <Loading label="Loading property visits…" />; if (state.error && !state.schedules.length) return <Failure message={state.error} retry={load} />
  return <><div className="page-heading"><div><span className="eyebrow">INSIDE SALES</span><h1>Property Visits</h1><p>Coordinate visit schedules with Outside Sales.</p></div><button className="primary-button" onClick={() => setShowForm(true)}>Schedule Visit</button></div>{state.error && <div className="inline-warning" role="alert">{state.error}</div>}<section className="card data-page-card"><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Property</th><th>Outside Sales</th><th>Scheduled</th><th>Status</th></tr></thead><tbody>{state.schedules.map(s => <tr key={s.id}><td>{s.customer?.fullName || `Customer #${s.customerId}`}</td><td>{s.property?.title || `Property #${s.propertyId}`}</td><td>{s.outsideSalesEmployee?.fullName || `Employee #${s.outsideSalesEmployeeId}`}</td><td>{formatDateTime(s.scheduledAt)}</td><td>{enumLabel(s.status)}</td></tr>)}</tbody></table></div>{!state.schedules.length && <Empty title="No property visits" text="Schedule a visit when a customer is ready." />}</section>{showForm && <div className="modal-backdrop"><form className="modal entity-form" onSubmit={submit}><button type="button" className="icon-button modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X /></button><h2>Schedule Visit</h2><label>Customer ID<input name="customerId" type="number" min="1" required /></label><label>Property ID<input name="propertyId" type="number" min="1" required /></label><label>Outside Sales employee ID<input name="outsideSalesEmployeeId" type="number" min="1" required /></label><label>Date and time<input name="scheduledAt" type="datetime-local" required /></label><label>Notes<textarea name="notes" /></label><button className="primary-button" disabled={saving}>{saving ? "Scheduling…" : "Schedule Visit"}</button></form></div>}</>
}

function Overview({ dashboard }) {
  const metrics = [
    ["Assigned customers", dashboard?.assignedCustomers],
    ["Interested customers", dashboard?.interestStatuses?.INTERESTED],
    ["Not interested", dashboard?.interestStatuses?.NOT_INTERESTED],
    ["Call outcomes", dashboard?.callActivity?.total],
    ["Property visits", dashboard?.visitSchedules?.total],
  ]
  return <section className="metric-grid">{metrics.map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{Number.isFinite(value) ? value : 0}</strong></article>)}</section>
}

export default function InsideSalesWorkspace() {
  const { section = "overview" } = useParams(); const { user } = useAuth(); const [profile, setProfile] = useState(null); const [dashboard, setDashboard] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [selected, setSelected] = useState(null)
  const loadOverview = useCallback(async () => { setLoading(true); setError(""); try { const [profileData, dashboardData] = await Promise.all([insideSalesApi.getProfile(), insideSalesApi.getDashboard()]); setProfile(profileData.user || profileData.profile || profileData); setDashboard(dashboardData); } catch (e) { setError(messageFor(e)) } finally { setLoading(false) } }, [])
  useEffect(() => { loadOverview() }, [loadOverview]); const title = useMemo(() => nav.find(([id]) => id === section)?.[1] || "Overview", [section])
  let content
  if (section === "customers" || section === "interested" || section === "not-interested") content = <Customers interestStatus={section === "interested" ? "INTERESTED" : section === "not-interested" ? "NOT_INTERESTED" : null} onOpen={setSelected} />
  else if (section === "assignments") content = <Schedules />
  else if (section === "visits") content = <><Schedules /><div className="page-heading"><div><span className="eyebrow">AVAILABLE PROPERTIES</span><h2>Properties</h2><p>Review available property documents before scheduling.</p></div></div><Properties /></>
  else if (section === "attendance") content = <EmployeeAttendance />
  else if (section === "announcements") content = <AnnouncementList role="INSIDE_SALES" />
  else if (section === "calls") content = <Customers onOpen={setSelected} />
  else if (section === "profile") content = loading ? <Loading label="Loading profile…" /> : error ? <Failure message={error} retry={loadOverview} /> : <section className="card data-page-card"><span className="eyebrow">INSIDE SALES</span><h2>{profile?.fullName || user?.name}</h2><p>{profile?.email}</p><p>{profile?.phone || "No phone number"}</p></section>
  else content = loading ? <Loading /> : error ? <Failure message={error} retry={loadOverview} /> : <Overview dashboard={dashboard} />
  return <Shell section={section} profile={profile}><div className="page-heading"><div><span className="eyebrow">INSIDE SALES</span><h1>{title}</h1><p>{section === "overview" ? "Live activity from your assigned customers and schedules." : "Live records from the management API."}</p></div></div>{content}{selected && <CustomerDetails customer={selected} onClose={() => setSelected(null)} refresh={() => {}} />}</Shell>
}
