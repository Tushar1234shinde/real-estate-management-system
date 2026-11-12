import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router"
import { roleRoute, useAuth } from "./AuthContext.jsx"

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") return <main className="auth-state">Checking your session…</main>
  if (status !== "authenticated") return <Navigate to="/" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireRole() {
  const { user } = useAuth()
  const { role } = useParams()
  const expectedRoleRoute = roleRoute(user?.role)

  if (!expectedRoleRoute || role !== expectedRoleRoute) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

export function UnauthorizedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const destination = roleRoute(user?.role)

  return (
    <main className="auth-state">
      <div>
        <h1>Unauthorized access</h1>
        <p>You do not have permission to access that workspace.</p>
        {destination && (
          <button
            className="primary-button"
            onClick={() => navigate(`/app/${destination}/overview`, { replace: true })}
          >
            Go to my workspace
          </button>
        )}
      </div>
    </main>
  )
}
