
import { useState } from "react"
import { Outlet, NavLink } from "react-router"

import {
  Bell,
  ChevronDown,
  HelpCircle,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  X,
  CalendarDays,
} from "lucide-react"

import { navByRole, roleNames } from "../../data/navigation.js"
import { getInitials } from "../../data/mockData.js"


// ==========================================
// SIDEBAR
// ==========================================

function Sidebar({ role, employee, open, onClose }) {
  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>

        <div className="sidebar-top">
          <div className="sidebar-logo">
            <strong>PROPTIDE</strong>
          </div>

          <button
            className="icon-button mobile-only"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>

        <nav aria-label="Workspace navigation">

          <span className="nav-heading">
            WORKSPACE
          </span>

          {navByRole[role]?.map(([id, label, Icon]) => (
            <NavLink
              key={id}
              to={`/app/${role}/${id}`}
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
              onClick={onClose}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}

        </nav>

        <div className="sidebar-support">
          <HelpCircle />

          <strong>Need assistance?</strong>

          <p>
            Contact our support team for assistance.
          </p>

          <a href="mailto:support@proptide.com">
            Contact support
          </a>
        </div>

        <div className="sidebar-user">

          <div className="avatar">
            {getInitials(employee?.name)}
          </div>

          <div>
            <strong>
              {employee?.name || "Demo user"}
            </strong>

            <small>
              {roleNames[role]}
            </small>
          </div>

          <MoreHorizontal />

        </div>

      </aside>

      {open && (
        <div
          className="sidebar-scrim"
          onClick={onClose}
        />
      )}
    </>
  )
}


// ==========================================
// HEADER
// ==========================================

function Header({ role, employee, onOpenSidebar }) {
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
        />
      </label>

      <div className="top-actions">

        <div className="role-switcher">
          <span>Workspace</span>

          <strong>
            {roleNames[role]}
          </strong>
        </div>

        <button
          className="icon-button notification-button"
          onClick={() => setNotifications((value) => !value)}
          aria-label="Toggle notifications"
        >
          <Bell />
          <i />
        </button>

        <div className="header-profile">

          <div className="avatar">
            {getInitials(employee?.name)}
          </div>

          <span>
            <strong>
              {employee?.name || "Demo user"}
            </strong>

            <small>
              {roleNames[role]}
            </small>
          </span>

          <ChevronDown />

        </div>

      </div>

      {notifications && (
        <div className="notification-panel">

          <strong>Notifications</strong>

          <p>
            <CalendarDays />
            Visit workflow updates
          </p>

          <p>
            <ShieldCheck />
            Privacy and security updates
          </p>

        </div>
      )}

    </header>
  )
}


// ==========================================
// DASHBOARD LAYOUT
// ==========================================

export default function DashboardLayout({ role, employee }) {
  const [sidebar, setSidebar] = useState(false)

  return (
    <div className="app-shell">

      <Sidebar
        role={role}
        employee={employee}
        open={sidebar}
        onClose={() => setSidebar(false)}
      />

      <div className="app-main">

        <Header
          role={role}
          employee={employee}
          onOpenSidebar={() => setSidebar(true)}
        />

        <main className="content">
          <Outlet />
        </main>

      </div>

    </div>
  )
}
