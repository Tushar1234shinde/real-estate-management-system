import { useState } from "react"
import { useNavigate } from "react-router"
import {
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react"

const roles = [
  { id: "admin", label: "Admin" },
  { id: "executive", label: "Executive" },
  { id: "inside-sales", label: "Inside Sales" },
  { id: "outside-sales", label: "Outside Sales" },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState("admin")
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState("")

  function login(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.get("email") || ""))
      nextErrors.email = "Enter a valid work email"
    if ((form.get("password") || "").length < 6)
      nextErrors.password = "Password must be at least 6 characters"
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) {
      setNotice("")
      navigate(`/app/${role}/overview`)
    }
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
              <Check /> Role-based demo views
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
          <h2>Open your demo workspace</h2>
          <p className="muted">
            Choose a role to preview its workflow. Credentials are not
            authenticated.
          </p>
          <form onSubmit={login} noValidate>
            <label className="field-label">
              Work email
              <input
                name="email"
                type="email"
                placeholder="name@proptide.com"
                defaultValue="admin@proptide.com"
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
                  defaultValue="proptide2025"
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
            <label className="field-label">
              Demo role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="login-options">
              <span className="muted">
                Demo mode · no credentials are checked
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setNotice(
                    "Password reset is not available in this frontend demo.",
                  )
                }
              >
                Forgot password?
              </button>
            </div>
            <button className="primary-button login-button">
              Open demo dashboard <ArrowRight size={18} />
            </button>
          </form>
          <div className="secure-note">
            <ShieldCheck size={16} /> Demo access · Authentication is not
            connected
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
