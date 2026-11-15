import { useCallback, useEffect, useMemo, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router"
import { CalendarDays, Contact, FileText, Home, Menu, Phone, RefreshCw, UserCheck, Users, X, Plus } from "lucide-react"
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

function CustomerDetails({ customer, onClose, refresh, onSchedule }) {
  const [current, setCurrent] = useState(customer); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [messageStatus, setMessageStatus] = useState("")
  async function updateInterest(interestStatus) { setSaving(true); setError(""); setMessageStatus(""); try { const data = await insideSalesApi.updateInterest(current.id, interestStatus); setCurrent(data.customer); const key = `outcome-${current.id}-${interestStatus}-${new Date(data.customer.updatedAt).getTime()}`; try { const outcome = await insideSalesApi.sendOutcomeWhatsApp(current.id, interestStatus, { headers: { "Idempotency-Key": key } }); setMessageStatus(outcome.queued ? "WhatsApp message queued." : outcome.acceptedByProvider ? "WhatsApp message sent." : "WhatsApp message status updated.") } catch (messageError) { setMessageStatus(`WhatsApp blocked: ${messageFor(messageError)}`) } refresh() } catch (e) { setError(messageFor(e)) } finally { setSaving(false) } }
  return <div className="modal-backdrop"><div className="modal customer-drawer"><button className="icon-button modal-close" onClick={onClose} aria-label="Close"><X /></button><span className="eyebrow">ASSIGNED CUSTOMER</span><h2>{current.fullName}</h2><p>{current.phone || "No phone number"} · {current.email || "No email"}</p>{error && <div className="inline-warning">{error}</div>}{messageStatus && <div className="toast-message">{messageStatus}</div>}<div className="modal-footer" style={{ flexWrap: "wrap", gap: "8px" }}><button className="secondary-button" disabled={saving} onClick={() => updateInterest("INTERESTED")}>Mark Interested</button><button className="secondary-button" disabled={saving} onClick={() => updateInterest("NOT_INTERESTED")}>Mark Not Interested</button>{onSchedule && <button className="primary-button" onClick={() => { onClose(); onSchedule(current); }}>Schedule Property Visit</button>}</div><CustomerCallLogs customerId={current.id} role="INSIDE_SALES" /></div></div>
}

function Properties() {
  const [state, setState] = useState({ loading: true, error: "", properties: [] }); const [selected, setSelected] = useState(null)
  const load = useCallback(async () => { setState(s => ({ ...s, loading: true, error: "" })); try { const data = await insideSalesApi.listAvailableProperties({ page: 1, pageSize: 100 }); setState({ loading: false, error: "", properties: data.properties || [] }) } catch (e) { setState({ loading: false, error: messageFor(e), properties: [] }) } }, [])
  useEffect(() => { load() }, [load]); if (state.loading) return <Loading label="Loading available properties…" />; if (state.error) return <Failure message={state.error} retry={load} />
  return <><section className="card data-page-card"><div className="table-scroll"><table><thead><tr><th>Property</th><th>Location</th><th>Price</th><th /></tr></thead><tbody>{state.properties.map(property => <tr key={property.id}><td><strong>{property.title}</strong><span>{property.status}</span></td><td>{property.location}</td><td>{property.price}</td><td><button className="secondary-button" onClick={() => setSelected(property)}>Documents</button></td></tr>)}</tbody></table></div>{!state.properties.length && <Empty title="No available properties" text="There are no available properties right now." />}</section>{selected && <div className="modal-backdrop"><div className="modal"><button className="icon-button modal-close" onClick={() => setSelected(null)} aria-label="Close"><X /></button><PropertyDocuments propertyId={selected.id} role="INSIDE_SALES" onClose={() => setSelected(null)} /></div></div>}</>
}

function Schedules({ initialCustomer, onClearInitialCustomer }) {
  const [state, setState] = useState({ loading: true, error: "", schedules: [] });
  const [showForm, setShowForm] = useState(Boolean(initialCustomer));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: "" }));
    try {
      const data = await insideSalesApi.listVisitSchedules({ page: 1, pageSize: 100 });
      setState({ loading: false, error: "", schedules: data.schedules || [] });
    } catch (e) {
      setState({ loading: false, error: messageFor(e), schedules: [] });
    }
  }, []);

  useEffect(() => { load() }, [load]);

  useEffect(() => {
    if (initialCustomer) {
      setShowForm(true);
    }
  }, [initialCustomer]);

  const loadFormData = useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      const [customersRes, propertiesRes, agentsRes] = await Promise.all([
        insideSalesApi.listCustomers({ page: 1, pageSize: 100 }),
        insideSalesApi.listAvailableProperties({ page: 1, pageSize: 100 }),
        insideSalesApi.listOutsideSalesAgents(),
      ]);
      setCustomers(customersRes.customers || []);
      setProperties(propertiesRes.properties || []);
      setAgents(agentsRes.agents || []);
    } catch (e) {
      setFormError(messageFor(e));
    } finally {
      setLoadingDropdowns(false);
    }
  }, []);

  function openScheduleModal() {
    setFormError("");
    setShowForm(true);
    loadFormData();
  }

  function closeScheduleModal() {
    setShowForm(false);
    setFormError("");
    if (onClearInitialCustomer) onClearInitialCustomer();
  }

  useEffect(() => {
    if (showForm && (!customers.length || !properties.length || !agents.length)) {
      loadFormData();
    }
  }, [showForm, customers.length, properties.length, agents.length, loadFormData]);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const customerId = Number(form.get("customerId"));
    const propertyId = Number(form.get("propertyId"));
    const outsideSalesEmployeeId = Number(form.get("outsideSalesEmployeeId"));
    const scheduledAtRaw = form.get("scheduledAt");

    if (!customerId || !propertyId || !outsideSalesEmployeeId || !scheduledAtRaw) {
      setFormError("Please select customer, property, outside sales agent, and scheduled date/time.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await insideSalesApi.createVisitSchedule({
        customerId,
        propertyId,
        outsideSalesEmployeeId,
        scheduledAt: new Date(scheduledAtRaw).toISOString(),
        notes: form.get("notes") || undefined
      });
      closeScheduleModal();
      await load();
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  if (state.loading) return <Loading label="Loading property visits…" />;
  if (state.error && !state.schedules.length) return <Failure message={state.error} retry={load} />;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INSIDE SALES</span>
          <h1>Property Visits</h1>
          <p>Coordinate visit schedules with Outside Sales.</p>
        </div>
        <button className="primary-button" onClick={openScheduleModal}>
          <Plus size={16} /> Schedule Visit
        </button>
      </div>
      {state.error && <div className="inline-warning" role="alert">{state.error}</div>}
      <section className="card data-page-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Property</th>
                <th>Outside Sales</th>
                <th>Scheduled</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.schedules.map(s => (
                <tr key={s.id}>
                  <td data-label="Customer">{s.customer?.fullName || `Customer #${s.customerId}`}</td>
                  <td data-label="Property">{s.property?.title || `Property #${s.propertyId}`}</td>
                  <td data-label="Outside Sales">{s.outsideSalesEmployee?.fullName || `Employee #${s.outsideSalesEmployeeId}`}</td>
                  <td data-label="Scheduled">{formatDateTime(s.scheduledAt)}</td>
                  <td data-label="Status">{enumLabel(s.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.schedules.length && <Empty title="No property visits" text="Schedule a visit when a customer is ready." />}
      </section>

      {showForm && (
        <div className="modal-backdrop" onClick={closeScheduleModal}>
          <form
            className="modal entity-form"
            onSubmit={submit}
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="icon-button modal-close"
              onClick={closeScheduleModal}
              aria-label="Close"
            >
              <X />
            </button>
            <span className="eyebrow">VISIT COORDINATION</span>
            <h2>Schedule Property Visit</h2>
            {formError && <div className="inline-warning" role="alert">{formError}</div>}
            {loadingDropdowns && <p className="muted">Loading assigned customers, properties, and agents…</p>}

            <label className="field-label">
              Assigned Customer *
              <select
                name="customerId"
                required
                defaultValue={initialCustomer ? initialCustomer.id : ""}
              >
                <option value="">Select an assigned customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.phone || "No phone"}) · {enumLabel(c.interestStatus)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Property *
              <select name="propertyId" required defaultValue="">
                <option value="">Select available property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.location} ({p.price})
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Outside Sales Representative *
              <select name="outsideSalesEmployeeId" required defaultValue="">
                <option value="">Select outside sales agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName} · {a.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Visit Date and Time *
              <input name="scheduledAt" type="datetime-local" required />
            </label>

            <label className="field-label">
              Notes for Outside Sales Agent
              <textarea
                name="notes"
                placeholder="e.g. Customer requested property brochure and parking directions"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={saving || loadingDropdowns}>
                {saving ? "Scheduling…" : "Confirm Schedule"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
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
  const { section = "overview" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [customerToSchedule, setCustomerToSchedule] = useState(null);
  const [customersRefreshKey, setCustomersRefreshKey] = useState(0);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, dashboardData] = await Promise.all([insideSalesApi.getProfile(), insideSalesApi.getDashboard()]);
      setProfile(profileData.user || profileData.profile || profileData);
      setDashboard(dashboardData);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview() }, [loadOverview]);
  const title = useMemo(() => nav.find(([id]) => id === section)?.[1] || "Overview", [section]);

  let content;
  if (section === "customers" || section === "interested" || section === "not-interested") {
    content = <Customers key={customersRefreshKey} interestStatus={section === "interested" ? "INTERESTED" : section === "not-interested" ? "NOT_INTERESTED" : null} onOpen={setSelected} />;
  } else if (section === "assignments" || section === "visits") {
    content = (
      <>
        <Schedules
          initialCustomer={customerToSchedule}
          onClearInitialCustomer={() => setCustomerToSchedule(null)}
        />
        {section === "visits" && (
          <>
            <div className="page-heading" style={{ marginTop: "24px" }}>
              <div>
                <span className="eyebrow">AVAILABLE PROPERTIES</span>
                <h2>Properties</h2>
                <p>Review available property documents before scheduling.</p>
              </div>
            </div>
            <Properties />
          </>
        )}
      </>
    );
  } else if (section === "attendance") {
    content = <EmployeeAttendance />;
  } else if (section === "announcements") {
    content = <AnnouncementList role="INSIDE_SALES" />;
  } else if (section === "calls") {
    content = <Customers onOpen={setSelected} />;
  } else if (section === "profile") {
    content = loading ? <Loading label="Loading profile…" /> : error ? <Failure message={error} retry={loadOverview} /> : (
      <section className="card data-page-card">
        <span className="eyebrow">INSIDE SALES</span>
        <h2>{profile?.fullName || user?.name}</h2>
        <p>{profile?.email}</p>
        <p>{profile?.phone || "No phone number"}</p>
      </section>
    );
  } else {
    content = loading ? <Loading /> : error ? <Failure message={error} retry={loadOverview} /> : <Overview dashboard={dashboard} />;
  }

  return (
    <Shell section={section} profile={profile}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INSIDE SALES</span>
          <h1>{title}</h1>
          <p>{section === "overview" ? "Live activity from your assigned customers and schedules." : "Live records from the management API."}</p>
        </div>
      </div>
      {content}
      {selected && (
        <CustomerDetails
          customer={selected}
          onClose={() => setSelected(null)}
          refresh={() => setCustomersRefreshKey((k) => k + 1)}
          onSchedule={(cust) => {
            setCustomerToSchedule(cust);
            navigate("/app/inside-sales/visits");
          }}
        />
      )}
    </Shell>
  );
}
