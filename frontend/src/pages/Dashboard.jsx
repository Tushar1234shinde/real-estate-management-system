import { useEffect, useMemo, useState } from "react"

import { NavLink, useNavigate, useParams } from "react-router"

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Contact,
  FileAudio,
  HelpCircle,
  Home,
  MapPin,
  Megaphone,
  Menu,
  MoreHorizontal,
  Navigation,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react"

import {
  createId,
  createInitialData,
  employeeRoles,
  getEmployeeById,
  getInitials,
  getRoleLabel,
  maskPhone,
  propertyOptions,
  roleNames,
  routeRoleValues,
} from "../data/mockData.js"

const STORAGE_KEY = "proptide-demo-data-v2"

const demoRoleLabels = {
  admin: "Admin",

  executive: "Executive",

  "inside-sales": "Inside Sales",

  "outside-sales": "Outside Sales",
}

const navByRole = {
  admin: [
    ["overview", "Overview", Home],

    ["employees", "Employee Management", Users],

    ["customers", "Customer Management", Contact],

    ["assignments", "Customer Assignments", UserCheck],
    ["visits", "Property Visits", MapPin],
    ["calls", "Call Records", Phone],
    ["media", "Media & Recordings", FileAudio],

    ["attendance", "Attendance", Clock3],

    ["announcements", "Announcements", Megaphone],

    ["settings", "Settings", Settings],
  ],

  executive: [
    ["overview", "Overview", Home],

    ["employees", "Employee List", Users],

    ["add-employee", "Add Employee", UserPlus],

    ["customers", "Customer List", Contact],

    ["add-customer", "Add Customer", Plus],

    ["assignments", "Assign Customer", UserCheck],
  ],

  "inside-sales": [
    ["overview", "Overview", Home],

    ["customers", "Assigned Customers", Contact],

    ["interested", "Interested Customers", Sparkles],

    ["not-interested", "Not Interested", CircleAlert],
    ["visits", "Property Visits", CalendarDays],
    ["calls", "Call Outcomes", Phone],
    ["assignments", "Outside Sales Assignments", UserCheck],

    ["profile", "My Profile", Users],
  ],

  "outside-sales": [
    ["overview", "Today's Visits", Home],

    ["customers", "Assigned Customers", Contact],

    ["visits", "Visit History", CalendarDays],

    ["profile", "My Profile", Users],
  ],
}

const sectionTitles = {
  employees: ["Employee Management", "View and manage employee records."],

  customers: ["Customer Management", "Review customer details and ownership."],

  assignments: [
    "Customer Assignments",
    "Assign customers to eligible employees.",
  ],

  visits: ["Property Visits", "Track scheduled, active, and completed visits."],
  calls: ["Call Records", "Review customer outcomes logged by Inside Sales."],

  attendance: ["Attendance", "Employee attendance information."],

  interested: ["Interested Customers", "Customers ready for the next step."],

  "not-interested": [
    "Not Interested Customers",

    "Review customer outcomes and follow-up history.",
  ],

  "add-employee": ["Add Employee", "Create a new employee record."],

  "add-customer": ["Add Customer", "Create a new customer record."],

  profile: ["Employee Profile", "Your demo profile information."],
}

function readStoredData() {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) return { data: createInitialData(), warning: "" }

  const parsed = JSON.parse(raw)

  if (
    !Array.isArray(parsed.employees) ||
    !Array.isArray(parsed.customers) ||
    !Array.isArray(parsed.visits) ||
    !Array.isArray(parsed.calls) ||
    !Array.isArray(parsed.announcements)
  ) {
    return {
      data: createInitialData(),

      warning: "Saved demo data was invalid, so the sample data was restored.",
    }
  }

  return { data: parsed, warning: "" }
}

function Logo() {
  return (
    <div className="app-logo">
      <span>
        <Building2 />
      </span>
      <div>
        PROPTIDE<small>OPERATIONS</small>
      </div>
    </div>
  )
}

function Sidebar({ role, employee, open, onClose }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-top">
        <Logo />
        <button
          className="icon-button mobile-only"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X />
        </button>
      </div>
      <nav aria-label="Workspace navigation">
        <span className="nav-heading">WORKSPACE</span>
        {navByRole[role].map(([id, label, Icon]) => (
          <NavLink
            key={id}
            to={`/app/${role}/${id}`}
            onClick={onClose}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon /> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-support">
        <div className="support-icon">
          <HelpCircle />
        </div>
        <strong>Need assistance?</strong>
        <p>This frontend demo does not connect to a support service.</p>
        <a href="mailto:support@proptide.com">Contact support</a>
      </div>
      <div className="sidebar-user">
        <div className="avatar">{getInitials(employee?.name)}</div>
        <div>
          <strong>{employee?.name || "Demo user"}</strong>
          <small>{roleNames[role]}</small>
        </div>
        <MoreHorizontal />
      </div>
    </aside>
  )
}

function Header({ role, employee, onOpenSidebar, onRoleChange, onSearch }) {
  const [notifications, setNotifications] = useState(false)

  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu />
      </button>
      <label className="top-search">
        <Search />
        <input
          placeholder="Search customers or employees"
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <div className="top-actions">
        <label className="role-switcher">
          <span>Demo role</span>
          <select
            value={role}
            onChange={(event) => onRoleChange(event.target.value)}
          >
            {Object.entries(roleNames).map(([key, value]) => (
              <option value={key} key={key}>
                {demoRoleLabels[key] || value}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button notification-button"
          onClick={() => setNotifications((value) => !value)}
          aria-label="Toggle notifications"
          aria-expanded={notifications}
        >
          <Bell />
          <i />
        </button>
        <div className="header-profile">
          <div className="avatar">{getInitials(employee?.name)}</div>
          <span>
            <strong>{employee?.name || "Demo user"}</strong>
            <small>{roleNames[role]}</small>
          </span>
          <ChevronDown />
        </div>
      </div>
      {notifications && (
        <div className="notification-panel">
          <div className="panel-heading">
            <div>
              <strong>Notifications</strong>
              <small>Frontend demo updates</small>
            </div>
            <button
              className="icon-button"
              onClick={() => setNotifications(false)}
              aria-label="Close notifications"
            >
              <X />
            </button>
          </div>
          <Notification
            icon={CalendarDays}
            title="Visit workflow"
            text="Visits must be marked reached before completion."
            time="Demo"
          />
          <Notification
            icon={ShieldCheck}
            title="Privacy"
            text="Customer phone numbers are masked in employee views."
            time="Demo"
          />
        </div>
      )}
    </header>
  )
}

function Notification({ icon: Icon, title, text, time }) {
  return (
    <div className="notification">
      <span>
        <Icon />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <small>{time}</small>
    </div>
  )
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  )
}

function CardHeading({ title, subtitle, action, onAction }) {
  return (
    <div className="card-heading">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction}>
          {action}
          <ChevronRight />
        </button>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone = "blue", onClick }) {
  return (
    <button className="stat-card" onClick={onClick} disabled={!onClick}>
      <div className={`stat-icon ${tone}`}>
        <Icon />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {onClick && <ArrowRight className="card-arrow" />}
    </button>
  )
}

function StatusBadge({ status }) {
  const tone =
    /complete|active|interested/i.test(status) && !/not/i.test(status)
      ? "success"
      : /scheduled|reached|contacted/i.test(status)
        ? "warning"
        : /not interested|inactive/i.test(status)
          ? "danger"
          : "neutral"

  return (
    <span className={`status ${tone}`}>
      <i />
      {status}
    </span>
  )
}

function EmptyState({
  title = "No matching records",
  text = "Try changing your search or filters.",
}) {
  return (
    <div className="empty-state">
      <Search />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function Overview({
  role,

  employee,

  data,

  onNavigate,

  onOpenModal,

  onMarkReached,

  onCompleteVisit,
}) {
  const employees = data.employees.filter((item) => item.status === "Active")

  const customers =
    role === "inside-sales"
      ? data.customers.filter(
          (item) => item.assignedInsideSalesId === employee?.id,
        )
      : data.customers

  const upcomingVisits = data.visits

    .filter((visit) => visit.status !== "Completed")

    .filter(
      (visit) =>
        role !== "outside-sales" ||
        visit.outsideSalesEmployeeId === employee?.id,
    )

  const myVisits = data.visits.filter(
    (visit) => visit.outsideSalesEmployeeId === employee?.id,
  )

  const stats =
    role === "inside-sales"
      ? [
          [Contact, "Assigned customers", customers.length, "customers"],

          [
            Sparkles,

            "Interested customers",

            customers.filter((item) => item.status === "Interested").length,

            "customers",
          ],

          [
            CalendarDays,

            "Upcoming visits",

            upcomingVisits.filter((visit) => visit.status === "Scheduled")
              .length,

            "visits",
          ],
        ]
      : role === "outside-sales"
        ? [
            [
              CalendarDays,

              "Today's visits",

              myVisits.filter(
                (visit) =>
                  visit.date === new Date().toISOString().slice(0, 10) &&
                  visit.status !== "Completed",
              ).length,

              "visits",
            ],

            [Clock3, "Upcoming visits", upcomingVisits.length, "visits"],

            [
              CheckCircle2,

              "Completed visits",

              myVisits.filter((visit) => visit.status === "Completed").length,

              "visits",
            ],
          ]
        : role === "executive"
          ? [
              [Users, "Total employees", employees.length, "employees"],

              [Contact, "Total customers", data.customers.length, "customers"],

              [
                CalendarDays,
                "Upcoming visits",
                upcomingVisits.length,
                "visits",
              ],
            ]
          : [
              [Users, "Total employees", data.employees.length, "employees"],

              [Contact, "Total customers", data.customers.length, "customers"],

              [
                UserPlus,

                "Inside Sales employees",

                data.employees.filter((item) => item.role === "INSIDE_SALES")
                  .length,

                "employees",
              ],

              [
                UserCheck,

                "Outside Sales employees",

                data.employees.filter((item) => item.role === "OUTSIDE_SALES")
                  .length,

                "employees",
              ],

              [
                CheckCircle2,

                "Executives",

                data.employees.filter((item) => item.role === "EXECUTIVE")
                  .length,

                "employees",
              ],
            ]

  return (
    <>
      <PageHeading
        eyebrow={role === "admin" ? "BUSINESS OVERVIEW" : "MY WORKSPACE"}
        title={`Good morning, ${employee?.name?.split(" ")[0] || "there"}`}
        subtitle="A live summary of the frontend demo records."
      >
        {role === "admin" || role === "executive" ? (
          <button
            className="primary-button"
            onClick={() => onOpenModal("employee")}
          >
            <Plus /> Add employee
          </button>
        ) : null}
      </PageHeading>
      {role === "inside-sales" && (
        <div className="location-banner">
          <div>
            <span>
              <ShieldCheck />
            </span>
            <div>
              <strong>Attendance and GPS are not connected</strong>
              <p>This demo does not verify physical location.</p>
            </div>
          </div>
        </div>
      )}
      <div className={`stats-grid ${stats.length === 3 ? "five" : ""}`}>
        {stats.map(([Icon, label, value, destination], index) => (
          <StatCard
            key={label}
            icon={Icon}
            label={label}
            value={value}
            tone={["blue", "purple", "cyan", "orange", "green"][index]}
            onClick={() => onNavigate(destination)}
          />
        ))}
      </div>
      {role === "outside-sales" ? (
        <VisitsTable
          visits={upcomingVisits}
          data={data}
          role={role}
          employee={employee}
          onMarkReached={onMarkReached}
          onCompleteVisit={onCompleteVisit}
          onNavigateVisits={() => onNavigate("visits")}
        />
      ) : (
        <section className="card table-card">
          <CardHeading
            title={
              role === "inside-sales"
                ? "My assigned customers"
                : "Recent customers"
            }
            subtitle={
              role === "inside-sales"
                ? "Only customers assigned to your demo employee profile."
                : "Shared customer records and assigned owners."
            }
            action="View all"
            onAction={() => onNavigate("customers")}
          />
          <CustomerTable
            rows={customers.slice(0, 5)}
            employees={data.employees}
            onSelect={() => onNavigate("customers")}
            role={role}
          />
        </section>
      )}
      {role === "inside-sales" && (
        <div className="hint-card">
          <Sparkles />
          <div>
            <strong>Interested customers only</strong>
            <p>
              Use the customer details panel to schedule a visit for an eligible
              Outside Sales employee.
            </p>
          </div>
        </div>
      )}
      {role === "admin" && (
        <div className="dashboard-grid">
          <section className="card performance-card">
            <CardHeading
              title="Operations at a glance"
              subtitle="Counts reflect the current local demo data."
            />
            <div className="pipeline-list">
              {[
                [
                  "New",
                  data.customers.filter((item) => item.status === "New").length,
                ],

                [
                  "Interested",

                  data.customers.filter((item) => item.status === "Interested")
                    .length,
                ],

                [
                  "Not interested",

                  data.customers.filter(
                    (item) => item.status === "Not Interested",
                  ).length,
                ],

                [
                  "Completed visits",

                  data.visits.filter((visit) => visit.status === "Completed")
                    .length,
                ],
              ].map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="card performance-card">
            <CardHeading
              title="Frontend capability notice"
              subtitle="No server-side services are connected."
            />
            <p className="muted">
              GPS verification, audio capture, secure sign-in, notifications,
              and durable media storage require platform or backend support.
            </p>
          </section>
        </div>
      )}
      {role === "inside-sales" && (
        <section className="card table-card">
          <CardHeading
            title="My scheduled visits"
            subtitle="Visits created for the customers you manage."
            action="View visits"
            onAction={() => onNavigate("visits")}
          />
          <VisitsTable
            visits={upcomingVisits}
            data={data}
            role={role}
            employee={employee}
            onMarkReached={onMarkReached}
            onCompleteVisit={onCompleteVisit}
          />
        </section>
      )}
    </>
  )
}

function CustomerTable({ rows, employees, onSelect, role }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Property interest</th>
            <th>Inside Sales owner</th>
            <th>Status</th>
            <th>Phone</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((customer) => {
            const owner = getEmployeeById(
              employees,

              customer.assignedInsideSalesId,
            )

            return (
              <tr key={customer.id} onClick={() => onSelect(customer)}>
                <td>
                  <div className="person-cell">
                    <div className="avatar soft">
                      {getInitials(customer.name)}
                    </div>
                    <div>
                      <strong>{customer.name}</strong>
                      <span>{customer.email || "No email provided"}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong className="table-main">{customer.property}</strong>
                </td>
                <td>{owner?.name || "Unassigned"}</td>
                <td>
                  <StatusBadge status={customer.status} />
                </td>
                <td>{maskPhone(customer.phone)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${customer.name}`}
                    onClick={(event) => {
                      event.stopPropagation()

                      onSelect(customer)
                    }}
                  >
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </div>
  )
}

function EmployeeTable({ rows, onSelect, onEdit, onToggleStatus, canManage }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((employee) => (
            <tr key={employee.id} onClick={() => onSelect(employee)}>
              <td>
                <div className="person-cell">
                  <div className="avatar soft">
                    {getInitials(employee.name)}
                  </div>
                  <div>
                    <strong>{employee.name}</strong>
                    <span>{employee.employeeId || "Employee ID not set"}</span>
                  </div>
                </div>
              </td>
              <td>{getRoleLabel(employee.role)}</td>
              <td>{employee.email}</td>
              <td>{maskPhone(employee.phone)}</td>
              <td>
                <StatusBadge status={employee.status} />
              </td>
              <td className="row-actions">
                {canManage && (
                  <>
                    <button
                      className="secondary-button"
                      onClick={(event) => {
                        event.stopPropagation()

                        onEdit(employee)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="icon-button"
                      aria-label={
                        employee.status === "Active"
                          ? `Deactivate ${employee.name}`
                          : `Activate ${employee.name}`
                      }
                      onClick={(event) => {
                        event.stopPropagation()

                        onToggleStatus(employee)
                      }}
                    >
                      {employee.status === "Active" ? <X /> : <Check />}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </div>
  )
}

function VisitsTable({
  visits,

  data,

  role,

  employee,

  previews = {},

  onMarkReached,

  onCompleteVisit,

  onNavigateVisits,
}) {
  return (
    <section className="card data-page-card">
      {onNavigateVisits && (
        <div className="table-card-heading">
          <CardHeading
            title="Assigned visits"
            subtitle="Only visits assigned to this Outside Sales employee."
            action="Visit history"
            onAction={onNavigateVisits}
          />
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Property</th>
              <th>Outside Sales employee</th>
              <th>Date & time</th>
              <th>Visit status</th>
              <th>Selfie</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => {
              const customer = data.customers.find(
                (item) => item.id === visit.customerId,
              )

              const outsideEmployee = getEmployeeById(
                data.employees,

                visit.outsideSalesEmployeeId,
              )

              const canUpdate =
                role === "outside-sales" &&
                employee?.id === visit.outsideSalesEmployeeId

              return (
                <tr key={visit.id}>
                  <td>{customer?.name || "Customer removed"}</td>
                  <td>{customer?.property || "—"}</td>
                  <td>{outsideEmployee?.name || "Unassigned"}</td>
                  <td>
                    {visit.date} · {visit.time}
                  </td>
                  <td>
                    <StatusBadge status={visit.status} />
                  </td>
                  <td>
                    {previews[visit.id] ? (
                      <img
                        className="selfie-preview"
                        src={previews[visit.id]}
                        alt={`Visit selfie for ${customer?.name || "customer"}`}
                      />
                    ) : (
                      visit.selfieName || "—"
                    )}
                  </td>
                  <td>
                    {canUpdate && visit.status === "Scheduled" && (
                      <button
                        className="primary-button"
                        onClick={() => onMarkReached(visit.id)}
                      >
                        <MapPin /> Reached location
                      </button>
                    )}
                    {canUpdate && visit.status === "Reached Location" && (
                      <button
                        className="success-button"
                        onClick={() => onCompleteVisit(visit.id)}
                      >
                        <CheckCircle2 /> Complete visit
                      </button>
                    )}
                    {visit.status === "Completed" && <span>Completed</span>}
                    {!canUpdate && visit.status !== "Completed" && (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!visits.length && (
          <EmptyState
            title="No visits scheduled"
            text="A visit will appear here after an interested customer is scheduled."
          />
        )}
      </div>
    </section>
  )
}

function ModulePage({
  role,

  section,

  employee,

  data,

  searchText,

  previews,

  onOpenModal,

  onSetOutcome,

  onEditEmployee,

  onToggleEmployee,

  onMarkReached,

  onCompleteVisit,
}) {
  const navigate = useNavigate()

  const [query, setQuery] = useState(searchText || "")

  const [filter, setFilter] = useState("All")

  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const title = sectionTitles[section] || ["Operations", "Manage demo records."]

  useEffect(() => {
    setQuery(searchText || "")
  }, [searchText])

  const employees = useMemo(() => {
    const roleFiltered = data.employees.filter((item) => {
      if (section === "employees" || section === "attendance") return true

      return item.role === "INSIDE_SALES"
    })

    return roleFiltered.filter((item) => {
      const matchesQuery =
        `${item.name} ${item.email} ${getRoleLabel(item.role)}`

          .toLowerCase()

          .includes(query.toLowerCase())

      const matchesFilter = filter === "All" || item.role === filter

      const matchesActive =
        section === "employees" ||
        section === "attendance" ||
        item.status === "Active"

      return matchesQuery && matchesFilter && matchesActive
    })
  }, [data.employees, filter, query, section])

  const customers = useMemo(() => {
    let rows = data.customers

    if (role === "inside-sales") {
      rows = rows.filter((item) => item.assignedInsideSalesId === employee?.id)
    } else if (role === "outside-sales") {
      const visitCustomerIds = new Set(
        data.visits

          .filter((visit) => visit.outsideSalesEmployeeId === employee?.id)

          .map((visit) => visit.customerId),
      )

      rows = rows.filter((item) => visitCustomerIds.has(item.id))
    }

    if (section === "interested") {
      rows = rows.filter((item) => item.status === "Interested")
    }

    if (section === "not-interested") {
      rows = rows.filter((item) => item.status === "Not Interested")
    }

    if (section === "assignments" && role === "inside-sales") {
      rows = rows.filter((item) => Boolean(item.assignedOutsideSalesId))
    }

    return rows.filter((item) => {
      const matchesQuery = `${item.name} ${item.email} ${item.property}`
        .toLowerCase()
        .includes(query.toLowerCase())

      const matchesFilter = filter === "All" || item.status === filter

      return matchesQuery && matchesFilter
    })
  }, [data.customers, data.visits, employee?.id, filter, query, role, section])

  if (section === "add-employee" || section === "add-customer") {
    return (
      <EntityForm
        type={section === "add-employee" ? "employee" : "customer"}
        role={role}
        insideEmployees={data.employees.filter(
          (item) => item.role === "INSIDE_SALES" && item.status === "Active",
        )}
        onCancel={() => navigate(-1)}
        onSave={(values) =>
          onOpenModal(
            section === "add-employee" ? "save-employee" : "save-customer",

            values,
          )
        }
      />
    )
  }

  if (section === "profile") {
    return <ProfilePage role={role} employee={employee} />
  }

  if (section === "media") {
    return <MediaPage visits={data.visits} data={data} previews={previews} />
  }

  if (section === "announcements") {
    return (
      <Announcements
        announcements={data.announcements}
        onCreate={() => onOpenModal("announcement")}
      />
    )
  }

  if (section === "settings") {
    return <SettingsPage />
  }
  if (section === "calls") {
    const calls = data.calls.filter(
      (call) => role !== "inside-sales" || call.employeeId === employee?.id,
    )
    return <CallRecordsPage calls={calls} data={data} role={role} />
  }
  if (section === "visits") {
    const visits = data.visits.filter((visit) => {
      if (role === "outside-sales") {
        return visit.outsideSalesEmployeeId === employee?.id
      }

      if (role === "inside-sales") {
        const customer = data.customers.find(
          (item) => item.id === visit.customerId,
        )

        return customer?.assignedInsideSalesId === employee?.id
      }

      return true
    })

    return (
      <>
        <PageHeading
          eyebrow={roleNames[role].toUpperCase()}
          title={title[0]}
          subtitle={title[1]}
        >
          {(role === "inside-sales" || role === "admin") && (
            <button
              className="primary-button"
              onClick={() => onOpenModal("visit")}
            >
              <Plus /> Schedule visit
            </button>
          )}
        </PageHeading>
        <VisitsTable
          visits={visits}
          data={data}
          role={role}
          employee={employee}
          previews={previews}
          onMarkReached={onMarkReached}
          onCompleteVisit={onCompleteVisit}
        />
      </>
    )
  }

  const isEmployeeList = section === "employees" || section === "attendance"

  const isAssignmentPage = section === "assignments"

  const filteredCustomers =
    section === "customers" ||
    section === "interested" ||
    section === "not-interested" ||
    isAssignmentPage
      ? customers
      : []

  function exportRows() {
    const records = isEmployeeList ? employees : filteredCustomers

    if (!records.length) return

    const headers = isEmployeeList
      ? ["Name", "Email", "Phone", "Role", "Status"]
      : ["Name", "Email", "Phone", "Property", "Status"]

    const values = records.map((item) =>
      isEmployeeList
        ? [
            item.name,
            item.email,
            item.phone,
            getRoleLabel(item.role),
            item.status,
          ]
        : [item.name, item.email, item.phone, item.property, item.status],
    )

    const csv = [headers, ...values]

      .map((row) =>
        row
          .map((value) => `"${String(value || "").replaceAll('"', '""')}"`)
          .join(","),
      )

      .join("\r\n")

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    )

    const link = document.createElement("a")

    link.href = url

    link.download = `${section}.csv`

    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeading
        eyebrow={roleNames[role].toUpperCase()}
        title={title[0]}
        subtitle={title[1]}
      >
        <button className="secondary-button" onClick={exportRows}>
          <Upload /> Export CSV
        </button>
        {(section === "employees" ||
          section === "customers" ||
          isAssignmentPage) && (
          <button
            className="primary-button"
            onClick={() =>
              onOpenModal(
                section === "employees"
                  ? "employee"
                  : isAssignmentPage
                    ? role === "inside-sales"
                      ? "visit"
                      : "assignment"
                    : "customer",
              )
            }
          >
            <Plus />
            {isAssignmentPage
              ? role === "inside-sales"
                ? "Schedule visit"
                : "New assignment"
              : `Add ${section === "employees" ? "employee" : "customer"}`}
          </button>
        )}
      </PageHeading>
      <section className="card data-page-card">
        <div className="table-toolbar">
          <div className="search-field">
            <Search />
            <input
              placeholder={`Search ${
                isEmployeeList ? "employees" : "customers"
              }...`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label={
                isEmployeeList ? "Filter employees" : "Filter customers"
              }
            >
              {isEmployeeList ? (
                <>
                  <option value="All">All roles</option>
                  {employeeRoles.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="All">All statuses</option>
                  {["New", "Contacted", "Interested", "Not Interested"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </>
              )}
            </select>
            <button
              className="secondary-button"
              onClick={() => {
                setQuery("")

                setFilter("All")
              }}
            >
              <SlidersHorizontal /> Clear filters
            </button>
          </div>
        </div>
        {isEmployeeList ? (
          <EmployeeTable
            rows={employees}
            onSelect={setSelectedEmployee}
            onEdit={onEditEmployee}
            onToggleStatus={onToggleEmployee}
            canManage={role === "admin"}
          />
        ) : (
          <CustomerTable
            rows={filteredCustomers}
            employees={data.employees}
            onSelect={setSelectedCustomer}
            role={role}
          />
        )}
        <div className="pagination">
          <span>
            Showing{" "}
            {isEmployeeList ? employees.length : filteredCustomers.length} local
            demo records
          </span>
        </div>
      </section>
      {selectedCustomer && (
        <CustomerDrawer
          customer={
            data.customers.find((item) => item.id === selectedCustomer.id) ||
            selectedCustomer
          }
          employees={data.employees}
          visits={data.visits}
          role={role}
          onClose={() => setSelectedCustomer(null)}
          onSetOutcome={onSetOutcome}
          onAssign={() => onOpenModal("assignment", selectedCustomer)}
          onSchedule={() => onOpenModal("visit", selectedCustomer)}
        />
      )}
      {selectedEmployee && (
        <EmployeeDrawer
          employee={
            data.employees.find((item) => item.id === selectedEmployee.id) ||
            selectedEmployee
          }
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => {
            onEditEmployee(selectedEmployee)

            setSelectedEmployee(null)
          }}
          onToggle={() => {
            onToggleEmployee(selectedEmployee)

            setSelectedEmployee(null)
          }}
          canManage={role === "admin"}
        />
      )}
    </>
  )
}

function EntityForm({ type, role, insideEmployees, onSave, onCancel }) {
  const [error, setError] = useState("")

  const navigate = useNavigate()

  const isEmployee = type === "employee"

  function submit(event) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const result = Object.fromEntries(form.entries())

    const message = onSave(result)

    if (message) setError(message)
    else navigate(`/app/${role}/${isEmployee ? "employees" : "customers"}`)
  }

  return (
    <>
      <button className="back-button" onClick={onCancel}>
        <ArrowLeft /> Back to {isEmployee ? "employees" : "customers"}
      </button>
      <PageHeading
        eyebrow="NEW RECORD"
        title={`Add ${type}`}
        subtitle="Complete the required fields. This record is saved only in this browser demo."
      />
      <form className="card entity-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field-label">
            Full name *
            <input name="name" required maxLength="100" />
          </label>
          <label className="field-label">
            Email address {isEmployee ? "*" : ""}
            <input name="email" type="email" required={isEmployee} />
          </label>
          <label className="field-label">
            Phone number *
            <div className="phone-input">
              <span>+91</span>
              <input
                name="phone"
                type="tel"
                required
                inputMode="numeric"
                pattern="[0-9 ]{10,12}"
                minLength="10"
                maxLength="12"
                placeholder="98765 43210"
                title="Enter a 10-digit phone number"
              />
            </div>
          </label>
          <label className="field-label">
            {isEmployee ? "Employee role *" : "Property interest *"}
            <select
              name={isEmployee ? "role" : "property"}
              required
              defaultValue=""
            >
              <option value="">Select an option</option>
              {(isEmployee ? employeeRoles : propertyOptions).map((item) =>
                isEmployee ? (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ) : (
                  <option key={item}>{item}</option>
                ),
              )}
            </select>
          </label>
          {isEmployee ? (
            <>
              <label className="field-label">
                Employee ID
                <input name="employeeId" maxLength="30" />
              </label>
              <label className="field-label">
                Status
                <select name="status" defaultValue="Active">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
            </>
          ) : (
            <label className="field-label">
              Assign to Inside Sales
              <select name="assignedInsideSalesId" defaultValue="">
                <option value="">Leave unassigned</option>
                {insideEmployees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {getRoleLabel(item.role)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="field-error form-error">{error}</p>}
        </div>
        <div className="form-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button">Create {type}</button>
        </div>
      </form>
    </>
  )
}

function CustomerDrawer({
  customer,

  employees,

  visits,

  role,

  onClose,

  onSetOutcome,

  onAssign,

  onSchedule,
}) {
  const owner = getEmployeeById(employees, customer.assignedInsideSalesId)

  const outsideOwner = getEmployeeById(
    employees,

    customer.assignedOutsideSalesId,
  )

  const relatedVisits = visits.filter(
    (visit) => visit.customerId === customer.id,
  )

  const canManage = role === "admin" || role === "inside-sales"
  const canAssignInside = role === "admin" || role === "executive"

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="detail-drawer" aria-label="Customer details">
        <div className="drawer-head">
          <span>CUSTOMER DETAILS</span>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="drawer-profile">
          <div className="avatar large">{getInitials(customer.name)}</div>
          <h2>{customer.name}</h2>
          <p>Customer ID · {customer.id}</p>
          <StatusBadge status={customer.status} />
        </div>
        <div className="drawer-section">
          <h4>Contact information</h4>
          <div className="detail-row">
            <Contact />
            <div>
              <span>Email</span>
              <strong>{customer.email || "Not provided"}</strong>
            </div>
          </div>
          <div className="detail-row">
            <Navigation />
            <div>
              <span>Phone</span>
              <strong>{maskPhone(customer.phone)}</strong>
            </div>
          </div>
          <div className="detail-row">
            <Building2 />
            <div>
              <span>Property interest</span>
              <strong>{customer.property}</strong>
            </div>
          </div>
        </div>
        <div className="drawer-section">
          <h4>Assignment</h4>
          <div className="owner-card">
            <div className="avatar soft">{getInitials(owner?.name || "?")}</div>
            <div>
              <strong>{owner?.name || "Unassigned"}</strong>
              <span>
                {owner ? getRoleLabel(owner.role) : "Inside Sales owner"}
              </span>
            </div>
          </div>
          {outsideOwner && (
            <div className="owner-card owner-card-spaced">
              <div className="avatar soft">
                {getInitials(outsideOwner.name)}
              </div>
              <div>
                <strong>{outsideOwner.name}</strong>
                <span>Outside Sales · scheduled visit</span>
              </div>
            </div>
          )}
        </div>
        <div className="drawer-section">
          <h4>Visit history</h4>
          {relatedVisits.length ? (
            relatedVisits.map((visit) => (
              <div className="visit-history-row" key={visit.id}>
                <span>
                  {visit.date} · {visit.time}
                </span>
                <StatusBadge status={visit.status} />
              </div>
            ))
          ) : (
            <p className="muted">No property visit has been scheduled.</p>
          )}
        </div>
        {(canManage || canAssignInside) && (
          <div className="drawer-actions">
            {canAssignInside && (
              <button
                className="secondary-button full-button"
                onClick={onAssign}
              >
                <UserCheck /> Assign Inside Sales
              </button>
            )}
            {canManage && (
              <>
                {role === "inside-sales" && (
                  <>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        onSetOutcome(customer.id, "Not Interested")
                      }
                      disabled={customer.status === "Not Interested"}
                    >
                      <X /> Not interested
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => onSetOutcome(customer.id, "Interested")}
                      disabled={customer.status === "Interested"}
                    >
                      <Check /> Mark interested
                    </button>
                  </>
                )}
                <button
                  className="secondary-button full-button"
                  onClick={onSchedule}
                  disabled={
                    customer.status !== "Interested" ||
                    relatedVisits.some((visit) => visit.status !== "Completed")
                  }
                >
                  <CalendarDays /> Schedule property visit
                </button>
                <a
                  className="whatsapp-button"
                  href={`https://wa.me/91${customer.phone}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Send /> Open WhatsApp
                </a>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function EmployeeDrawer({ employee, onClose, onEdit, onToggle, canManage }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="detail-drawer" aria-label="Employee details">
        <div className="drawer-head">
          <span>EMPLOYEE DETAILS</span>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="drawer-profile">
          <div className="avatar large">{getInitials(employee.name)}</div>
          <h2>{employee.name}</h2>
          <p>{employee.employeeId || "Employee ID not set"}</p>
          <StatusBadge status={employee.status} />
        </div>
        <div className="drawer-section">
          <h4>Employment information</h4>
          <div className="detail-row">
            <UserCheck />
            <div>
              <span>Designation</span>
              <strong>{getRoleLabel(employee.role)}</strong>
            </div>
          </div>
          <div className="detail-row">
            <Contact />
            <div>
              <span>Email</span>
              <strong>{employee.email}</strong>
            </div>
          </div>
          <div className="detail-row">
            <Navigation />
            <div>
              <span>Phone</span>
              <strong>{maskPhone(employee.phone)}</strong>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="drawer-actions">
            <button className="primary-button" onClick={onEdit}>
              Edit employee
            </button>
            <button className="secondary-button" onClick={onToggle}>
              {employee.status === "Active" ? "Deactivate" : "Activate"}{" "}
              employee
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

function ProfilePage({ role, employee }) {
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="Employee Profile"
        subtitle="Demo identity associated with the selected role."
      />
      <div className="profile-layout">
        <section className="card profile-card">
          <div className="profile-cover" />
          <div className="avatar profile-avatar">
            {getInitials(employee?.name)}
          </div>
          <h2>{employee?.name || "Demo user"}</h2>
          <p>
            {roleNames[role]} · {employee?.employeeId || "Demo account"}
          </p>
          <StatusBadge status={employee?.status || "Active"} />
          <div className="profile-details">
            <div>
              <span>Email</span>
              <strong>{employee?.email || "Not provided"}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{maskPhone(employee?.phone)}</strong>
            </div>
            <div>
              <span>Employee ID</span>
              <strong>{employee?.employeeId || "Not set"}</strong>
            </div>
            <div>
              <span>Location status</span>
              <strong>Not available in frontend demo</strong>
            </div>
          </div>
        </section>
        <section className="card attendance-card">
          <CardHeading
            title="Attendance and location"
            subtitle="No device location is collected by this demo."
          />
          <div className="empty-state">
            <Navigation />
            <h3>Location verification unavailable</h3>
            <p>GPS and attendance services require platform integration.</p>
          </div>
        </section>
      </div>
    </>
  )
}

function MediaPage({ visits, data, previews }) {
  const records = visits.filter(
    (visit) => visit.selfieName || previews[visit.id],
  )

  return (
    <>
      <PageHeading
        eyebrow="QUALITY & COMPLIANCE"
        title="Media & Recordings"
        subtitle="Review selfie files selected during this browser demo."
      />
      <div className="hint-card">
        <FileAudio />
        <div>
          <strong>Voice recordings are not available</strong>
          <p>
            Background audio recording and persistent media storage require
            platform permissions and backend support.
          </p>
        </div>
      </div>
      <div className="media-grid">
        {records.map((visit) => {
          const customer = data.customers.find(
            (item) => item.id === visit.customerId,
          )

          return (
            <article className="card media-card" key={visit.id}>
              {previews[visit.id] ? (
                <img
                  className="media-image"
                  src={previews[visit.id]}
                  alt={`Uploaded selfie for ${customer?.name || "customer"}`}
                />
              ) : (
                <div className="selfie-placeholder">
                  <div className="avatar large">
                    {getInitials(customer?.name)}
                  </div>
                  <span>
                    <Camera /> {visit.selfieName}
                  </span>
                </div>
              )}
              <div className="media-copy">
                <div>
                  <h3>{customer?.name || "Customer"}</h3>
                  <p>
                    {customer?.property} · {visit.date}
                  </p>
                </div>
                <StatusBadge status={visit.status} />
              </div>
            </article>
          )
        })}
      </div>
      {!records.length && (
        <EmptyState
          title="No selfie files yet"
          text="An uploaded selfie will appear after a visit is completed."
        />
      )}
    </>
  )
}

function CallRecordsPage({ calls, data, role }) {
  return (
    <>
      <PageHeading
        eyebrow={roleNames[role].toUpperCase()}
        title="Call Records"
        subtitle="Manual customer outcomes saved in the frontend demo."
      />
      <div className="hint-card">
        <Phone />
        <div>
          <strong>Phone calls are not placed or recorded</strong>
          <p>
            Inside Sales outcome actions create a local record; telephony
            integration is not connected.
          </p>
        </div>
      </div>
      <section className="card data-page-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Inside Sales employee</th>
                <th>Outcome</th>
                <th>Recorded at</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const customer = data.customers.find(
                  (item) => item.id === call.customerId,
                )
                const owner = getEmployeeById(data.employees, call.employeeId)
                return (
                  <tr key={call.id}>
                    <td>{customer?.name || "Customer removed"}</td>
                    <td>{owner?.name || "Employee removed"}</td>
                    <td>
                      <StatusBadge status={call.outcome} />
                    </td>
                    <td>{new Date(call.createdAt).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!calls.length && (
            <EmptyState
              title="No call outcomes recorded"
              text="Mark a customer Interested or Not Interested to add a demo call outcome."
            />
          )}
        </div>
      </section>
    </>
  )
}

function Announcements({ announcements, onCreate }) {
  return (
    <>
      <PageHeading
        eyebrow="TEAM COMMUNICATION"
        title="Announcements"
        subtitle="Create and review local demo notices. Delivery is not connected."
      >
        <button className="primary-button" onClick={onCreate}>
          <Plus /> New announcement
        </button>
      </PageHeading>
      <div className="announcement-layout">
        <section className="card">
          {announcements.map((item) => (
            <article className="announcement" key={item.id}>
              <div className="announce-icon">
                <Megaphone />
              </div>
              <div>
                <div className="announcement-title">
                  <h3>{item.title}</h3>
                  <span>{item.audience}</span>
                </div>
                <p>{item.message}</p>
                <small>
                  Saved locally · {new Date(item.createdAt).toLocaleString()}
                </small>
              </div>
            </article>
          ))}
          {!announcements.length && <EmptyState title="No announcements yet" />}
        </section>
        <aside className="card announcement-tip">
          <span>
            <Megaphone />
          </span>
          <h3>Local demo notices</h3>
          <p>
            Messages stay in this browser and are not delivered to employees.
          </p>
        </aside>
      </div>
    </>
  )
}

function SettingsPage() {
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Workspace Settings"
        subtitle="Settings that require backend or device support are read-only here."
      />
      <section className="card settings-card">
        {[
          ["Office location", "Not configured", "Requires backend"],

          ["Default work hours", "Not configured", "Requires admin settings"],

          ["Visit recording", "Not available", "Requires device permission"],

          [
            "Customer phone privacy",
            "Last four digits shown",
            "Enabled in demo",
          ],
        ].map(([title, text, value]) => (
          <div className="setting-row" key={title}>
            <span>
              <Settings />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
            <span className="setting-value">{value}</span>
          </div>
        ))}
      </section>
    </>
  )
}

function Modal({
  type,

  record,

  visitId,

  role,

  employee,

  data,

  onClose,

  onSave,

  onSetPreview,
}) {
  const [error, setError] = useState("")

  const [previewUrl, setPreviewUrl] = useState("")

  const titles = {
    employee: ["Add employee", "Create a new employee record."],

    customer: ["Add customer", "Capture a new customer enquiry."],

    assignment: ["Assign customer", "Select an Inside Sales employee."],

    visit: [
      "Schedule property visit",
      "Choose an eligible customer and field employee.",
    ],

    announcement: ["New announcement", "Save an in-app demo notice."],

    complete: [
      "Complete customer visit",
      "Upload a selfie and add visit notes.",
    ],
  }

  const [title, subtitle] = titles[type] || titles.customer

  const insideEmployees = data.employees.filter(
    (item) => item.role === "INSIDE_SALES" && item.status === "Active",
  )

  const outsideEmployees = data.employees.filter(
    (item) => item.role === "OUTSIDE_SALES" && item.status === "Active",
  )

  const customersForVisit = data.customers.filter(
    (customer) =>
      customer.status === "Interested" &&
      (role !== "inside-sales" ||
        customer.assignedInsideSalesId === employee?.id) &&
      !data.visits.some(
        (visit) =>
          visit.customerId === customer.id && visit.status !== "Completed",
      ),
  )

  const activeVisit = data.visits.find((visit) => visit.id === visitId)

  function submit(event) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const values = Object.fromEntries(form.entries())

    if (type === "complete") {
      const file = form.get("selfie")

      if (!(file instanceof File) || !file.size) {
        setError("Upload a customer selfie to complete this visit.")

        return
      }

      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
        setError("Choose an image file smaller than 10 MB.")

        return
      }

      values.selfieName = file.name

      values.preview = previewUrl || URL.createObjectURL(file)

      values.visitId = visitId
    }

    const message = onSave(type, values, record)

    if (message) {
      setError(message)
    } else if (type === "complete") {
      onSetPreview(visitId, values.preview)
    }
  }

  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">
              {record && type === "employee" ? "Edit employee" : title}
            </h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          {type === "complete" ? (
            <>
              <label className="upload-zone">
                <Camera />
                <strong>Upload customer selfie *</strong>
                <span>PNG, JPG or another image · Max 10 MB</span>
                <input
                  name="selfie"
                  required
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0]

                    if (previewUrl) URL.revokeObjectURL(previewUrl)

                    setPreviewUrl(file ? URL.createObjectURL(file) : "")
                  }}
                />
              </label>
              {previewUrl && (
                <img
                  className="upload-preview"
                  src={previewUrl}
                  alt="Selfie preview"
                />
              )}
              <label className="field-label">
                Visit notes
                <textarea name="notes" rows="3" maxLength="500" />
              </label>
              <p className="muted">
                The photo preview is kept in memory only and is not uploaded to
                a server.
              </p>
            </>
          ) : (
            <div className="modal-grid">
              {type === "announcement" ? (
                <>
                  <label className="field-label full">
                    Title *
                    <input name="title" required maxLength="100" />
                  </label>
                  <label className="field-label full">
                    Message *
                    <textarea
                      name="message"
                      required
                      rows="4"
                      maxLength="1000"
                    />
                  </label>
                  <label className="field-label full">
                    Audience
                    <select name="audience" defaultValue="All employees">
                      <option>All employees</option>
                      <option>Inside Sales</option>
                      <option>Outside Sales</option>
                      <option>Executives</option>
                    </select>
                  </label>
                </>
              ) : type === "employee" ? (
                <>
                  <label className="field-label full">
                    Employee name *
                    <input
                      name="name"
                      required
                      defaultValue={record?.name || ""}
                      maxLength="100"
                    />
                  </label>
                  <label className="field-label full">
                    Email address *
                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={record?.email || ""}
                    />
                  </label>
                  <label className="field-label full">
                    Phone number *
                    <input
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9 ]{10,12}"
                      minLength="10"
                      maxLength="12"
                      required
                      defaultValue={record?.phone || ""}
                      title="Enter a 10-digit phone number"
                    />
                  </label>
                  <label className="field-label">
                    Employee role *
                    <select
                      name="role"
                      required
                      defaultValue={record?.role || ""}
                    >
                      <option value="">Select a role</option>
                      {employeeRoles.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Status
                    <select
                      name="status"
                      defaultValue={record?.status || "Active"}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </label>
                  <label className="field-label full">
                    Employee ID
                    <input
                      name="employeeId"
                      defaultValue={record?.employeeId || ""}
                      maxLength="30"
                    />
                  </label>
                </>
              ) : type === "customer" ? (
                <>
                  <label className="field-label full">
                    Customer name *
                    <input name="name" required maxLength="100" />
                  </label>
                  <label className="field-label full">
                    Email address
                    <input name="email" type="email" />
                  </label>
                  <label className="field-label full">
                    Phone number *
                    <input
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9 ]{10,12}"
                      minLength="10"
                      maxLength="12"
                      required
                    />
                  </label>
                  <label className="field-label full">
                    Property interest *
                    <select name="property" required defaultValue="">
                      <option value="">Select a property</option>
                      {propertyOptions.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label full">
                    Assign to Inside Sales
                    <select name="assignedInsideSalesId" defaultValue="">
                      <option value="">Leave unassigned</option>
                      {insideEmployees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {getRoleLabel(item.role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : type === "assignment" ? (
                <>
                  <label className="field-label full">
                    Customer *
                    <select
                      name="customerId"
                      required
                      defaultValue={record?.id || ""}
                    >
                      <option value="">Select a customer</option>
                      {data.customers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label full">
                    Inside Sales employee *
                    <select name="employeeId" required defaultValue="">
                      <option value="">Select an employee</option>
                      {insideEmployees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {getRoleLabel(item.role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : type === "visit" ? (
                <>
                  <label className="field-label full">
                    Interested customer *
                    <select
                      name="customerId"
                      required
                      defaultValue={record?.id || ""}
                    >
                      <option value="">Select an eligible customer</option>
                      {customersForVisit.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.property}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label full">
                    Outside Sales employee *
                    <select name="employeeId" required defaultValue="">
                      <option value="">Select an employee</option>
                      {outsideEmployees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {getRoleLabel(item.role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Date *
                    <input
                      name="date"
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                  <label className="field-label">
                    Time *
                    <input name="time" type="time" required />
                  </label>
                  {!customersForVisit.length && (
                    <p className="muted full">
                      No interested customers are currently available to
                      schedule.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}
          {error && <p className="field-error form-error">{error}</p>}
          <div className="modal-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={
                type === "complete" ? "success-button" : "primary-button"
              }
              disabled={
                type === "complete" &&
                activeVisit?.status !== "Reached Location"
              }
            >
              {record && type === "employee" ? "Save employee" : title}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Dashboard() {
  const params = useParams()

  const navigate = useNavigate()

  const role = roleNames[params.role] ? params.role : "admin"

  const section = params.section || "overview"

  const [data, setData] = useState(createInitialData)

  const [loaded, setLoaded] = useState(false)

  const [storageWarning, setStorageWarning] = useState("")

  const [sidebar, setSidebar] = useState(false)

  const [modal, setModal] = useState(null)

  const [globalSearch, setGlobalSearch] = useState("")

  const [toast, setToast] = useState("")

  const [previews, setPreviews] = useState({})

  useEffect(() => {
    try {
      const saved = readStoredData()

      setData(saved.data)

      setStorageWarning(saved.warning)
    } catch (error) {
      console.error("Could not load local demo data.", error)

      setStorageWarning(
        "Saved demo data could not be loaded. Sample data is active.",
      )
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return

    try {
      const serializable = {
        ...data,

        visits: data.visits.map(({ preview, ...visit }) => visit),
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
    } catch (error) {
      console.error("Could not save local demo data.", error)

      setStorageWarning(
        "Changes are active for this session but could not be saved in this browser.",
      )
    }
  }, [data, loaded])

  useEffect(() => {
    if (!roleNames[params.role]) {
      navigate("/app/admin/overview", { replace: true })

      return
    }

    if (!navByRole[role].some(([id]) => id === section)) {
      navigate(`/app/${role}/overview`, { replace: true })
    }
  }, [navigate, params.role, role, section])

  useEffect(() => {
    if (!toast) return undefined

    const timeout = window.setTimeout(() => setToast(""), 3500)

    return () => window.clearTimeout(timeout)
  }, [toast])

  const employee = data.employees.find(
    (item) => item.role === routeRoleValues[role] && item.status === "Active",
  )

  function showMessage(message) {
    setToast(message)
  }

  function openModal(type, record = null, visitId = null) {
    setModal({ type, record, visitId })
  }

  function saveRecord(type, values, record = null) {
    const cleanName = String(values.name || "").trim()

    const normalizedEmail = String(values.email || "")
      .trim()
      .toLowerCase()

    const phone = String(values.phone || "").replace(/\D/g, "")

    if (type === "employee") {
      if (role !== "admin" && role !== "executive") {
        return "Only Admin or Executive demo roles can manage employees."
      }

      if (!cleanName) return "Enter an employee name."

      if (phone.length !== 10) return "Enter a valid 10-digit phone number."

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return "Enter a valid employee email address."
      }

      if (
        data.employees.some(
          (item) =>
            item.email.toLowerCase() === normalizedEmail &&
            item.id !== record?.id,
        )
      ) {
        return "An employee with this email address already exists."
      }

      const roleValue = values.role || record?.role

      if (!employeeRoles.some((item) => item.value === roleValue)) {
        return "Select a valid employee role."
      }

      if (
        record?.id === employee?.id &&
        (roleValue !== record.role || values.status === "Inactive")
      ) {
        return "The active demo identity cannot be reassigned or deactivated."
      }

      if (record) {
        const hasAssignedCustomers = data.customers.some(
          (item) => item.assignedInsideSalesId === record.id,
        )

        const hasActiveVisits = data.visits.some(
          (visit) =>
            visit.outsideSalesEmployeeId === record.id &&
            visit.status !== "Completed",
        )

        if (
          hasAssignedCustomers &&
          (roleValue !== "INSIDE_SALES" || values.status === "Inactive")
        ) {
          return "Reassign this employee's customers before changing their role or status."
        }

        if (
          hasActiveVisits &&
          (roleValue !== "OUTSIDE_SALES" || values.status === "Inactive")
        ) {
          return "Complete or reassign this employee's active visits before changing their role or status."
        }
      }

      const nextEmployee = {
        ...record,

        id: record?.id || createId("emp"),

        name: cleanName,

        email: normalizedEmail,

        phone,

        role: roleValue,

        status: values.status || "Active",

        employeeId: String(values.employeeId || "").trim(),
      }

      setData((current) => ({
        ...current,

        employees: record
          ? current.employees.map((item) =>
              item.id === record.id ? nextEmployee : item,
            )
          : [...current.employees, nextEmployee],
      }))

      setModal(null)

      showMessage(record ? "Employee updated." : "Employee added.")

      return ""
    }

    if (type === "customer") {
      if (role !== "admin" && role !== "executive") {
        return "Only Admin or Executive demo roles can add customers."
      }

      if (!cleanName) return "Enter a customer name."

      if (phone.length !== 10) return "Enter a valid 10-digit phone number."

      if (
        normalizedEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        return "Enter a valid customer email address."
      }

      if (
        normalizedEmail &&
        data.customers.some(
          (item) => item.email?.toLowerCase() === normalizedEmail,
        )
      ) {
        return "A customer with this email address already exists."
      }

      const assigned = getEmployeeById(
        data.employees,

        values.assignedInsideSalesId,
      )

      if (
        values.assignedInsideSalesId &&
        (!assigned ||
          assigned.role !== "INSIDE_SALES" ||
          assigned.status !== "Active")
      ) {
        return "Choose an active Inside Sales employee."
      }

      const customer = {
        id: createId("cus"),

        name: cleanName,

        email: normalizedEmail,

        phone,

        property: values.property,

        status: "New",

        assignedInsideSalesId: values.assignedInsideSalesId || "",
      }

      if (!propertyOptions.includes(values.property)) {
        return "Select a valid property."
      }

      setData((current) => ({
        ...current,
        customers: [...current.customers, customer],
      }))

      setModal(null)

      showMessage("Customer added.")

      return ""
    }

    if (type === "assignment") {
      if (role !== "admin" && role !== "executive") {
        return "Only Admin or Executive demo roles can assign Inside Sales owners."
      }

      const customer = data.customers.find(
        (item) => item.id === values.customerId,
      )

      const assignedEmployee = getEmployeeById(
        data.employees,
        values.employeeId,
      )

      if (!customer) return "Select a valid customer."

      if (
        !assignedEmployee ||
        assignedEmployee.role !== "INSIDE_SALES" ||
        assignedEmployee.status !== "Active"
      ) {
        return "Assignments are limited to active Inside Sales employees."
      }

      setData((current) => ({
        ...current,

        customers: current.customers.map((item) =>
          item.id === customer.id
            ? { ...item, assignedInsideSalesId: assignedEmployee.id }
            : item,
        ),
      }))

      setModal(null)

      showMessage(`${customer.name} assigned to ${assignedEmployee.name}.`)

      return ""
    }

    if (type === "visit") {
      if (role !== "admin" && role !== "inside-sales") {
        return "Only Admin or Inside Sales demo roles can schedule visits."
      }

      const customer = data.customers.find(
        (item) => item.id === values.customerId,
      )

      const assignedEmployee = getEmployeeById(
        data.employees,
        values.employeeId,
      )

      if (!customer || customer.status !== "Interested") {
        return "Only interested customers can be scheduled for a visit."
      }

      if (
        role === "inside-sales" &&
        customer.assignedInsideSalesId !== employee?.id
      ) {
        return "You can schedule visits only for customers assigned to you."
      }

      if (
        data.visits.some(
          (visit) =>
            visit.customerId === customer.id && visit.status !== "Completed",
        )
      ) {
        return "This customer already has an active visit. Complete it before scheduling another."
      }

      if (
        !assignedEmployee ||
        assignedEmployee.role !== "OUTSIDE_SALES" ||
        assignedEmployee.status !== "Active"
      ) {
        return "Choose an active Outside Sales employee."
      }

      if (!values.date || !values.time) {
        return "Choose a visit date and time."
      }

      if (values.date < new Date().toISOString().slice(0, 10)) {
        return "Visit date cannot be in the past."
      }

      const visit = {
        id: createId("visit"),

        customerId: customer.id,

        outsideSalesEmployeeId: assignedEmployee.id,

        date: values.date,

        time: values.time,

        status: "Scheduled",

        selfieName: "",

        notes: "",
      }

      setData((current) => ({
        ...current,

        visits: [...current.visits, visit],

        customers: current.customers.map((item) =>
          item.id === customer.id
            ? { ...item, assignedOutsideSalesId: assignedEmployee.id }
            : item,
        ),
      }))

      setModal(null)

      showMessage(`Visit scheduled for ${customer.name}.`)

      return ""
    }

    if (type === "announcement") {
      const announcement = {
        id: createId("announcement"),

        title: String(values.title || "").trim(),

        message: String(values.message || "").trim(),

        audience: values.audience || "All employees",

        createdAt: new Date().toISOString(),
      }

      setData((current) => ({
        ...current,

        announcements: [announcement, ...current.announcements],
      }))

      setModal(null)

      showMessage("Announcement saved locally. No employees were notified.")

      return ""
    }

    if (type === "complete") {
      const visit = data.visits.find((item) => item.id === values.visitId)

      if (
        !visit ||
        visit.status !== "Reached Location" ||
        role !== "outside-sales" ||
        visit.outsideSalesEmployeeId !== employee?.id
      ) {
        return "Mark the visit as reached before completing it."
      }

      if (!values.selfieName)
        return "Upload a customer selfie to complete this visit."

      setData((current) => ({
        ...current,

        visits: current.visits.map((item) =>
          item.id === visit.id
            ? {
                ...item,

                status: "Completed",

                selfieName: values.selfieName,

                notes: String(values.notes || "").trim(),
              }
            : item,
        ),
      }))

      setModal(null)

      showMessage(
        "Visit completed. The selected selfie remains in this session only.",
      )

      return ""
    }

    return "This action is not available."
  }

  function setCustomerOutcome(customerId, status) {
    const customer = data.customers.find((item) => item.id === customerId)
    if (
      !customer ||
      role !== "inside-sales" ||
      customer.assignedInsideSalesId !== employee?.id
    ) {
      showMessage("You can update only customers assigned to your demo role.")
      return
    }

    if (
      status === "Not Interested" &&
      data.visits.some(
        (visit) =>
          visit.customerId === customerId && visit.status !== "Completed",
      )
    ) {
      showMessage(
        "Complete or cancel the scheduled visit before changing this status.",
      )

      return
    }

    const call = {
      id: createId("call"),
      customerId,
      employeeId: employee.id,
      outcome: status,
      createdAt: new Date().toISOString(),
    }
    setData((current) => ({
      ...current,
      customers: current.customers.map((item) =>
        item.id === customerId ? { ...item, status } : item,
      ),
      calls: [call, ...current.calls],
    }))

    showMessage(`Customer marked ${status.toLowerCase()}.`)
  }

  function toggleEmployeeStatus(employeeRecord) {
    if (
      employeeRecord.id === employee?.id &&
      employeeRecord.status === "Active"
    ) {
      showMessage("The active demo identity cannot be deactivated.")

      return
    }

    if (
      employeeRecord.status === "Active" &&
      employeeRecord.role === "INSIDE_SALES" &&
      data.customers.some(
        (item) => item.assignedInsideSalesId === employeeRecord.id,
      )
    ) {
      showMessage("Reassign this employee's customers before deactivation.")

      return
    }

    if (
      employeeRecord.status === "Active" &&
      employeeRecord.role === "OUTSIDE_SALES" &&
      data.visits.some(
        (visit) =>
          visit.outsideSalesEmployeeId === employeeRecord.id &&
          visit.status !== "Completed",
      )
    ) {
      showMessage("Complete this employee's active visits before deactivation.")

      return
    }

    const status = employeeRecord.status === "Active" ? "Inactive" : "Active"

    setData((current) => ({
      ...current,

      employees: current.employees.map((item) =>
        item.id === employeeRecord.id ? { ...item, status } : item,
      ),
    }))

    showMessage(`${employeeRecord.name} is now ${status.toLowerCase()}.`)
  }

  function markReached(visitId) {
    const visit = data.visits.find((item) => item.id === visitId)

    if (
      !visit ||
      visit.status !== "Scheduled" ||
      role !== "outside-sales" ||
      visit.outsideSalesEmployeeId !== employee?.id
    ) {
      showMessage(
        "Only the assigned Outside Sales employee can start this visit.",
      )

      return
    }

    setData((current) => ({
      ...current,

      visits: current.visits.map((item) =>
        item.id === visitId ? { ...item, status: "Reached Location" } : item,
      ),
    }))

    showMessage("Visit marked as reached.")
  }

  function startVisitCompletion(visitId) {
    const visit = data.visits.find((item) => item.id === visitId)

    if (
      !visit ||
      visit.status !== "Reached Location" ||
      role !== "outside-sales" ||
      visit.outsideSalesEmployeeId !== employee?.id
    ) {
      showMessage("Only the assigned employee can complete a reached visit.")

      return
    }

    setModal({ type: "complete", visitId })
  }

  function editEmployee(employeeRecord) {
    setModal({ type: "employee", record: employeeRecord })
  }

  function setPreview(visitId, url) {
    setPreviews((current) => ({ ...current, [visitId]: url }))
  }

  function navigateToSection(destination) {
    const target =
      destination === "employees" && role === "inside-sales"
        ? "customers"
        : destination === "customers" && role === "outside-sales"
          ? "visits"
          : destination

    navigate(`/app/${role}/${target}`)
  }

  const permittedSection = navByRole[role].some(([id]) => id === section)

  if (!permittedSection && roleNames[params.role]) return null

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        employee={employee}
        open={sidebar}
        onClose={() => setSidebar(false)}
      />
      {sidebar && (
        <div
          className="sidebar-scrim"
          onClick={() => setSidebar(false)}
          role="presentation"
        />
      )}
      <div className="app-main">
        <Header
          role={role}
          employee={employee}
          onOpenSidebar={() => setSidebar(true)}
          onRoleChange={(nextRole) => {
            setGlobalSearch("")

            navigate(`/app/${nextRole}/overview`)
          }}
          onSearch={(value) => {
            setGlobalSearch(value)

            if (
              value &&
              (section === "overview" ||
                section === "visits" ||
                section === "profile")
            ) {
              navigate(`/app/${role}/customers`)
            }
          }}
        />
        <main className="content">
          {storageWarning && (
            <div className="inline-warning" role="status">
              {storageWarning}
            </div>
          )}
          {section === "overview" ? (
            <Overview
              role={role}
              employee={employee}
              data={data}
              onNavigate={navigateToSection}
              onOpenModal={openModal}
              onMarkReached={markReached}
              onCompleteVisit={startVisitCompletion}
            />
          ) : (
            <ModulePage
              key={`${role}:${section}`}
              role={role}
              section={section}
              employee={employee}
              data={data}
              searchText={globalSearch}
              previews={previews}
              onOpenModal={(type, record) => {
                if (type === "save-employee" || type === "save-customer") {
                  const message = saveRecord(
                    type === "save-employee" ? "employee" : "customer",

                    record,
                  )

                  if (message) showMessage(message)

                  return message
                }

                openModal(type, record)
              }}
              onSetOutcome={setCustomerOutcome}
              onEditEmployee={editEmployee}
              onToggleEmployee={toggleEmployeeStatus}
              onMarkReached={markReached}
              onCompleteVisit={startVisitCompletion}
            />
          )}
        </main>
      </div>
      {modal && (
        <Modal
          type={modal.type}
          record={modal.record}
          visitId={modal.visitId}
          role={role}
          employee={employee}
          data={data}
          onClose={() => {
            setModal(null)
          }}
          onSave={saveRecord}
          onSetPreview={setPreview}
        />
      )}
      {toast && (
        <div className="toast-message" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

export default Dashboard
