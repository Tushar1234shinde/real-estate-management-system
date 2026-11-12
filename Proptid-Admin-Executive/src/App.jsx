
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router"

import DashboardLayout from "./components/layout/DashboardLayout"

// ==========================================
// ADMIN PAGES
// ==========================================

import AdminOverview from "./pages/admin/AdminOverview"
import AdminEmployees from "./pages/admin/AdminEmployees"
import AdminCustomers from "./pages/admin/AdminCustomers"
import AdminAssignments from "./pages/admin/AdminAssignments"
import AdminVisits from "./pages/admin/AdminVisits"
import AdminCalls from "./pages/admin/AdminCalls"
import AdminMedia from "./pages/admin/AdminMedia"
import AdminAttendance from "./pages/admin/AdminAttendance"
import AdminAnnouncements from "./pages/admin/AdminAnnouncements"
import AdminSettings from "./pages/admin/AdminSettings"

// ==========================================
// EXECUTIVE PAGES
// ==========================================

import ExecutiveOverview from "./pages/executive/ExecutiveOverview"
import ExecutiveEmployees from "./pages/executive/ExecutiveEmployees"
import ExecutiveCustomers from "./pages/executive/ExecutiveCustomers"
import ExecutiveAssignments from "./pages/executive/ExecutiveAssignments"
import ExecutiveSettings from "./pages/executive/ExecutiveSettings"

// ==========================================
// COMMON PAGES
// ==========================================

import SignOut from "./components/common/SignOut"


// ==========================================
// ADMIN DASHBOARD LAYOUT
// ==========================================

function AdminDashboard() {
  return (
    <DashboardLayout
      role="admin"
      employee={{ name: "Arjun Sharma" }}
    />
  )
}


// ==========================================
// EXECUTIVE DASHBOARD LAYOUT
// ==========================================

function ExecutiveDashboard() {
  return (
    <DashboardLayout
      role="executive"
      employee={{ name: "Dev Patil" }}
    />
  )
}


// ==========================================
// PLACEHOLDER PAGE
// ==========================================

function Placeholder({ role }) {
  return (
    <div className="card">
      <h2>{role} Workspace</h2>
      <p>This page is under development.</p>
    </div>
  )
}


// ==========================================
// MAIN APP
// ==========================================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ROOT REDIRECT */}
        <Route
          path="/"
          element={
            <Navigate
              to="/app/admin/overview"
              replace
            />
          }
        />


        {/* ==================================
            ADMIN ROUTES
        ================================== */}

        <Route
          path="/app/admin"
          element={<AdminDashboard />}
        >

          <Route
            index
            element={
              <Navigate
                to="overview"
                replace
              />
            }
          />

          <Route
            path="overview"
            element={<AdminOverview />}
          />

          <Route
            path="employees"
            element={<AdminEmployees />}
          />

          <Route
            path="customers"
            element={<AdminCustomers />}
          />

          <Route
            path="assignments"
            element={<AdminAssignments />}
          />

          <Route
            path="visits"
            element={<AdminVisits />}
          />

          <Route
            path="calls"
            element={<AdminCalls />}
          />

          <Route
            path="media"
            element={<AdminMedia />}
          />

          <Route
            path="attendance"
            element={<AdminAttendance />}
          />

          <Route
            path="announcements"
            element={<AdminAnnouncements />}
          />

          <Route
            path="settings"
            element={<AdminSettings />}
          />

          <Route
            path="signout"
            element={<SignOut role="admin" />}
          />

          <Route
            path=":section"
            element={<Placeholder role="Admin" />}
          />

        </Route>


        {/* ==================================
            EXECUTIVE ROUTES
        ================================== */}

        <Route
          path="/app/executive"
          element={<ExecutiveDashboard />}
        >

          <Route
            index
            element={
              <Navigate
                to="overview"
                replace
              />
            }
          />

          <Route
            path="overview"
            element={<ExecutiveOverview />}
          />

          <Route
            path="employees"
            element={<ExecutiveEmployees />}
          />

          <Route
            path="customers"
            element={<ExecutiveCustomers />}
          />

          <Route
            path="assignments"
            element={<ExecutiveAssignments />}
          />

          <Route
            path="settings"
            element={<ExecutiveSettings />}
          />

          <Route
            path="signout"
            element={<SignOut role="executive" />}
          />


          {/* OLD ROUTE REDIRECTS */}

          <Route
            path="add-employee"
            element={
              <Navigate
                to="/app/executive/employees"
                replace
              />
            }
          />

          <Route
            path="add-customer"
            element={
              <Navigate
                to="/app/executive/customers"
                replace
              />
            }
          />

          <Route
            path=":section"
            element={<Placeholder role="Executive" />}
          />

        </Route>


        {/* ==================================
            FALLBACK ROUTE
        ================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/app/admin/overview"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App
