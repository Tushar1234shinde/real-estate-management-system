
import { useState } from "react"
import { useNavigate } from "react-router"
import { LogOut, ShieldCheck } from "lucide-react"

export default function SignOut({ role = "admin" }) {
  const navigate = useNavigate()
  const [signedOut, setSignedOut] = useState(false)

  const roleName = role === "executive" ? "Executive" : "Admin"

  function cancelSignOut() {
    navigate(`/app/${role}/overview`)
  }

  return (
    <div className="signout-page">
      <style>{`
        .signout-page {
          min-height: 65vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 25px;
        }

        .signout-card {
          width: 100%;
          max-width: 440px;
          padding: 35px;
          text-align: center;
          background: #fff;
          border: 1px solid #e6ebf2;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(20, 40, 70, 0.05);
        }

        .signout-icon {
          width: 65px;
          height: 65px;
          display: grid;
          place-items: center;
          margin: 0 auto 20px;
          border-radius: 50%;
          background: #fff1f1;
          color: #dc2626;
        }

        .signout-card h2 {
          margin: 0 0 10px;
          color: #26364d;
          font-size: 23px;
        }

        .signout-card p {
          margin: 0 0 25px;
          color: #8290a5;
          font-size: 14px;
          line-height: 1.6;
        }

        .signout-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .signout-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .signout-cancel {
          background: white;
          border: 1px solid #dce3ed;
          color: #53647c;
        }

        .signout-confirm {
          background: #dc2626;
          border: 1px solid #dc2626;
          color: white;
        }

        .signout-confirm:hover {
          background: #b91c1c;
        }

        .signout-success {
          background: #eaf8ef;
          color: #159957;
        }
      `}</style>

      <div className="signout-card">
        {signedOut ? (
          <>
            <div className="signout-icon signout-success">
              <ShieldCheck size={30} />
            </div>

            <h2>Signed Out</h2>
            <p>
              You have completed the sign-out screen for the {roleName}
              workspace. You can close this page.
            </p>
          </>
        ) : (
          <>
            <div className="signout-icon">
              <LogOut size={29} />
            </div>

            <h2>Sign Out</h2>
            <p>
              Are you sure you want to sign out of the {roleName}
              workspace?
            </p>

            <div className="signout-actions">
              <button
                className="signout-button signout-cancel"
                onClick={cancelSignOut}
              >
                Cancel
              </button>

              <button
                className="signout-button signout-confirm"
                onClick={() => setSignedOut(true)}
              >
                <LogOut size={16} />
                Yes, Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
