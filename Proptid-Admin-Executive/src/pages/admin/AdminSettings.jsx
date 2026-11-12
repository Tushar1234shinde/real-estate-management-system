
import { useState } from "react"
import {
  User,
  Building2,
  Bell,
  ShieldCheck,
  Save,
  RotateCcw,
} from "lucide-react"

import PageHeading from "../../components/common/PageHeading"

const defaultSettings = {
  name: "Arjun Sharma",
  email: "admin@proptide.com",
  phone: "9876543210",
  designation: "System Administrator",

  companyName: "Proptide",
  companyEmail: "support@proptide.com",
  companyPhone: "08012345678",
  address: "Bengaluru, Karnataka",

  emailNotifications: true,
  announcementNotifications: true,
  attendanceNotifications: true,
  visitNotifications: true,

  twoFactor: false,
  sessionAlerts: true,
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(defaultSettings)
  const [activeTab, setActiveTab] = useState("profile")
  const [savedMessage, setSavedMessage] = useState("")

  const updateField = (event) => {
    const { name, value, type, checked } = event.target

    setSettings((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }))

    setSavedMessage("")
  }

  const saveSettings = (event) => {
    event.preventDefault()

    // Frontend demo only.
    // Backend persistence will be added during integration.
    setSavedMessage("Your changes have been saved for this session.")
  }

  const resetSettings = () => {
    const confirmed = window.confirm(
      "Reset all settings to their default values?"
    )

    if (!confirmed) return

    setSettings(defaultSettings)
    setSavedMessage("")
  }

  const tabs = [
    { id: "profile", label: "Admin Profile", icon: User },
    { id: "workspace", label: "Workspace", icon: Building2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: ShieldCheck },
  ]

  return (
    <div>
      <PageHeading
        title="Settings"
        description="Manage your admin profile, workspace and preferences."
      />

      <div className="settings-layout">
        <aside className="card settings-sidebar">
          <h3>Settings</h3>

          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-tab ${
                activeTab === id ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(id)
                setSavedMessage("")
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        <section className="card settings-content">
          <form onSubmit={saveSettings}>
            {activeTab === "profile" && (
              <div>
                <div className="settings-section-heading">
                  <h2>Admin Profile</h2>
                  <p>Update your personal account information.</p>
                </div>

                <div className="settings-profile">
                  <div className="settings-avatar">
                    {settings.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>{settings.name || "Admin User"}</strong>
                    <p>Administrator account</p>
                  </div>
                </div>

                <div className="settings-form-grid">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      name="name"
                      value={settings.name}
                      onChange={updateField}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={settings.email}
                      onChange={updateField}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      name="phone"
                      value={settings.phone}
                      onChange={updateField}
                    />
                  </div>

                  <div className="form-group">
                    <label>Designation</label>
                    <input
                      name="designation"
                      value={settings.designation}
                      onChange={updateField}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "workspace" && (
              <div>
                <div className="settings-section-heading">
                  <h2>Workspace Details</h2>
                  <p>Manage your organisation's information.</p>
                </div>

                <div className="settings-form-grid">
                  <div className="form-group">
                    <label>Company Name</label>
                    <input
                      name="companyName"
                      value={settings.companyName}
                      onChange={updateField}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Company Email</label>
                    <input
                      type="email"
                      name="companyEmail"
                      value={settings.companyEmail}
                      onChange={updateField}
                    />
                  </div>

                  <div className="form-group">
                    <label>Company Phone</label>
                    <input
                      name="companyPhone"
                      value={settings.companyPhone}
                      onChange={updateField}
                    />
                  </div>

                  <div className="form-group">
                    <label>Office Address</label>
                    <input
                      name="address"
                      value={settings.address}
                      onChange={updateField}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <div className="settings-section-heading">
                  <h2>Notification Preferences</h2>
                  <p>Choose which updates you want to receive.</p>
                </div>

                <div className="settings-options">
                  <label className="settings-option">
                    <span>
                      <strong>Email Notifications</strong>
                      <small>Receive important updates by email.</small>
                    </span>
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      checked={settings.emailNotifications}
                      onChange={updateField}
                    />
                  </label>

                  <label className="settings-option">
                    <span>
                      <strong>Announcement Notifications</strong>
                      <small>Get notified when announcements are created.</small>
                    </span>
                    <input
                      type="checkbox"
                      name="announcementNotifications"
                      checked={settings.announcementNotifications}
                      onChange={updateField}
                    />
                  </label>

                  <label className="settings-option">
                    <span>
                      <strong>Attendance Notifications</strong>
                      <small>Receive employee attendance updates.</small>
                    </span>
                    <input
                      type="checkbox"
                      name="attendanceNotifications"
                      checked={settings.attendanceNotifications}
                      onChange={updateField}
                    />
                  </label>

                  <label className="settings-option">
                    <span>
                      <strong>Property Visit Notifications</strong>
                      <small>Receive updates about scheduled visits.</small>
                    </span>
                    <input
                      type="checkbox"
                      name="visitNotifications"
                      checked={settings.visitNotifications}
                      onChange={updateField}
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div>
                <div className="settings-section-heading">
                  <h2>Security Settings</h2>
                  <p>Manage your account security preferences.</p>
                </div>

                <div className="settings-options">
                  <label className="settings-option">
                    <span>
                      <strong>Two-Factor Authentication</strong>
                      <small>
                        Enable an additional verification step when signing in.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      name="twoFactor"
                      checked={settings.twoFactor}
                      onChange={updateField}
                    />
                  </label>

                  <label className="settings-option">
                    <span>
                      <strong>Login Session Alerts</strong>
                      <small>
                        Receive alerts about account login activity.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      name="sessionAlerts"
                      checked={settings.sessionAlerts}
                      onChange={updateField}
                    />
                  </label>
                </div>

                <div className="settings-security-note">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Account security</strong>
                    <p>
                      Password changes, login verification and active-session
                      management will be connected to the authentication
                      backend later.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="settings-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={resetSettings}
              >
                <RotateCcw size={16} />
                Reset
              </button>

              <div className="settings-save-area">
                {savedMessage && (
                  <span className="settings-saved-message">
                    {savedMessage}
                  </span>
                )}

                <button type="submit" className="primary-button">
                  <Save size={17} />
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
