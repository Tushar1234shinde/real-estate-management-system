
import { useState } from "react"
import { User, Bell, Shield, Save } from "lucide-react"
import PageHeading from "../../components/common/PageHeading"

export default function ExecutiveSettings() {
  const [profile, setProfile] = useState({
    name: "Dev Patil",
    email: "dev@example.com",
    phone: "",
  })

  const [notifications, setNotifications] = useState({
    assignments: true,
    visits: true,
    announcements: true,
    reminders: true,
  })

  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  })

  const [message, setMessage] = useState("")

  function saveProfile(event) {
    event.preventDefault()
    localStorage.setItem("proptide_executive_profile", JSON.stringify(profile))
    setMessage("Profile settings saved for this browser.")
  }

  function saveNotifications() {
    localStorage.setItem(
      "proptide_executive_notifications",
      JSON.stringify(notifications)
    )
    setMessage("Notification preferences saved.")
  }

  function savePassword(event) {
    event.preventDefault()

    if (!password.current || !password.next || !password.confirm) {
      setMessage("Please fill in all password fields.")
      return
    }

    if (password.next !== password.confirm) {
      setMessage("New password and confirmation do not match.")
      return
    }

    if (password.next.length < 8) {
      setMessage("New password must contain at least 8 characters.")
      return
    }

    setMessage(
      "Password change UI is ready. Connect authentication before using this feature."
    )
    setPassword({ current: "", next: "", confirm: "" })
  }

  return (
    <div className="executive-settings-page">
      <style>{`
        .executive-settings-page {
          color: #26364d;
        }

        .es-card {
          background: #fff;
          border: 1px solid #e6ebf2;
          border-radius: 13px;
          padding: 22px;
          margin-bottom: 20px;
        }

        .es-card-heading {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 20px;
        }

        .es-card-heading h3 {
          margin: 0 0 4px;
          font-size: 16px;
        }

        .es-card-heading p {
          margin: 0;
          color: #8290a5;
          font-size: 12px;
        }

        .es-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf3ff;
          color: #2864df;
        }

        .es-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .es-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .es-field label {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
        }

        .es-field input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #dfe6ef;
          border-radius: 8px;
          outline: none;
          color: #26364d;
          font-size: 13px;
        }

        .es-field input:focus {
          border-color: #2864df;
        }

        .es-save {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 18px;
          padding: 11px 17px;
          border: 0;
          border-radius: 8px;
          background: #2864df;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }

        .es-save:hover {
          background: #1e50bd;
        }

        .es-toggle-list {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .es-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .es-toggle-row strong {
          display: block;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .es-toggle-row span {
          color: #8794a8;
          font-size: 12px;
        }

        .es-toggle-row input {
          width: 18px;
          height: 18px;
          accent-color: #2864df;
          cursor: pointer;
        }

        .es-message {
          padding: 12px 15px;
          margin-bottom: 18px;
          border-radius: 8px;
          background: #eaf8ef;
          color: #168d51;
          font-size: 13px;
        }

        @media (max-width: 650px) {
          .es-form-grid {
            grid-template-columns: 1fr;
          }

          .es-card {
            padding: 16px;
          }
        }
      `}</style>

      <PageHeading
        title="Executive Settings"
        description="Manage your personal profile, notifications and security preferences."
      />

      {message && <div className="es-message">{message}</div>}

      <form className="es-card" onSubmit={saveProfile}>
        <div className="es-card-heading">
          <div className="es-icon"><User size={20} /></div>
          <div>
            <h3>Profile Information</h3>
            <p>Update your personal contact details.</p>
          </div>
        </div>

        <div className="es-form-grid">
          <div className="es-field">
            <label>Full Name</label>
            <input
              value={profile.name}
              onChange={(e) =>
                setProfile({ ...profile, name: e.target.value })
              }
              required
            />
          </div>

          <div className="es-field">
            <label>Email Address</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
              required
            />
          </div>

          <div className="es-field">
            <label>Phone Number</label>
            <input
              value={profile.phone}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <button className="es-save" type="submit">
          <Save size={16} /> Save Profile
        </button>
      </form>

      <section className="es-card">
        <div className="es-card-heading">
          <div className="es-icon"><Bell size={20} /></div>
          <div>
            <h3>Notifications</h3>
            <p>Choose which updates you want to receive.</p>
          </div>
        </div>

        <div className="es-toggle-list">
          {[
            ["assignments", "Customer assignments", "When a customer is assigned to you."],
            ["visits", "Property visits", "Updates about scheduled property visits."],
            ["announcements", "Company announcements", "Important updates from Admin."],
            ["reminders", "Follow-up reminders", "Reminders for pending customer follow-ups."],
          ].map(([key, title, description]) => (
            <label className="es-toggle-row" key={key}>
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
              <input
                type="checkbox"
                checked={notifications[key]}
                onChange={(e) =>
                  setNotifications({
                    ...notifications,
                    [key]: e.target.checked,
                  })
                }
              />
            </label>
          ))}
        </div>

        <button className="es-save" onClick={saveNotifications}>
          <Save size={16} /> Save Preferences
        </button>
      </section>

      <form className="es-card" onSubmit={savePassword}>
        <div className="es-card-heading">
          <div className="es-icon"><Shield size={20} /></div>
          <div>
            <h3>Security</h3>
            <p>Change your account password.</p>
          </div>
        </div>

        <div className="es-form-grid">
          <div className="es-field">
            <label>Current Password</label>
            <input
              type="password"
              value={password.current}
              onChange={(e) =>
                setPassword({ ...password, current: e.target.value })
              }
            />
          </div>

          <div className="es-field">
            <label>New Password</label>
            <input
              type="password"
              value={password.next}
              onChange={(e) =>
                setPassword({ ...password, next: e.target.value })
              }
            />
          </div>

          <div className="es-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={password.confirm}
              onChange={(e) =>
                setPassword({ ...password, confirm: e.target.value })
              }
            />
          </div>
        </div>

        <button className="es-save" type="submit">
          <Shield size={16} /> Update Password
        </button>
      </form>
    </div>
  )
}
