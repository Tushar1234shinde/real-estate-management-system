import { useState } from "react"
import { Navigate, useNavigate } from "react-router"
import { roleRoute, useAuth } from "../auth/AuthContext.jsx"
import {
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react"

export default function LoginPage() {
  const navigate = useNavigate()
  const { status, user, signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function login(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextErrors = {}
    const email = String(form.get("email") || "").trim().toLowerCase()
    const password = String(form.get("password") || "")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      nextErrors.email = "Enter a valid work email"
    if (password.length < 6)
      nextErrors.password = "Password must be at least 6 characters"
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setNotice("")
    setSubmitting(true)
    try {
      const authenticatedUser = await signIn({ email, password })
      const route = roleRoute(authenticatedUser.role)
      if (!route) {
        setNotice("Your account does not have access to a workspace.")
        return
      }
      navigate(`/app/${route}/overview`, { replace: true })
    } catch (error) {
      setNotice(error.message || "Unable to sign in. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading") {
    return <main className="auth-state">Checking your session…</main>
  }

  if (status === "authenticated" && roleRoute(user?.role)) {
    return <Navigate to={`/app/${roleRoute(user.role)}/overview`} replace />
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark">
          <Building2 size={24} />
        </div>
        <div className="login-story">
          <span className="eyebrow dark">ONE PLATFORM. EVERY OPPORTUNITY.</span>
          <h1>
            Real estate operations,
            <br />
            beautifully connected.
          </h1>
          <p>
            Empower your sales teams, improve field execution, and turn every
            customer interaction into a measurable outcome.
          </p>
          <div className="promise-list">
            <span>
              <Check /> Centralized lead operations
            </span>
            <span>
              <Check /> Clear field visit workflows
            </span>
            <span>
              <Check /> Role-based workspaces
            </span>
          </div>
        </div>
        <div className="login-brand-foot">
          PROPTIDE <span>OPERATIONS CLOUD</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-brand">
            <div className="brand-mark">
              <Building2 size={20} />
            </div>{" "}
            Proptide
          </div>
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Open your workspace</h2>
          <p className="muted">
            Sign in with your work credentials to access your assigned
            workspace.
          </p>
          <form onSubmit={login} noValidate>
            <label className="field-label">
              Work email
              <input
                name="email"
                type="email"
                placeholder="name@proptide.com"
                autoComplete="email"
              />
              {errors.email && (
                <small className="field-error">{errors.email}</small>
              )}
            </label>
            <label className="field-label">
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <small className="field-error">{errors.password}</small>
              )}
            </label>
            <div className="login-options">
              <span className="muted">Use your assigned work credentials</span>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setNotice(
                    "Password reset is not available in this application.",
                  )
                }
              >
                Forgot password?
              </button>
            </div>
            <button className="primary-button login-button" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"} <ArrowRight size={18} />
            </button>
          </form>
          <div className="secure-note">
            <ShieldCheck size={16} /> Secure, role-based access
          </div>
          {notice && <small className="field-error">{notice}</small>}
        </div>
        <p className="login-help">
          Need help?{" "}
          <a href="mailto:support@proptide.com">Contact IT support</a>
        </p>
      </section>
    </main>
  )
}
