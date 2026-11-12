import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { getCurrentUser, login, logout } from "../api/auth.js"
import { getAuthToken } from "../api/tokenStorage.js"

const AuthContext = createContext(null)

export const ROLE_ROUTES = {
  ADMIN: "admin",
  EXECUTIVE: "executive",
  INSIDE_SALES: "inside-sales",
  OUTSIDE_SALES: "outside-sales",
}

export function roleRoute(role) {
  return ROLE_ROUTES[role] || null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    let active = true

    async function restoreSession() {
      if (!getAuthToken()) {
        if (active) setStatus("unauthenticated")
        return
      }

      try {
        const data = await getCurrentUser()
        if (active) {
          setUser(data.user)
          setStatus("authenticated")
        }
      } catch {
        logout()
        if (active) {
          setUser(null)
          setStatus("unauthenticated")
        }
      }
    }

    restoreSession()
    function handleUnauthorized() {
      setUser(null)
      setStatus("unauthenticated")
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized)
    return () => {
      active = false
      window.removeEventListener("auth:unauthorized", handleUnauthorized)
    }
  }, [])

  async function signIn(credentials) {
    try {
      await login(credentials)
      const data = await getCurrentUser()
      setUser(data.user)
      setStatus("authenticated")
      return data.user
    } catch (error) {
      logout()
      setUser(null)
      setStatus("unauthenticated")
      throw error
    }
  }

  function signOut() {
    logout()
    setUser(null)
    setStatus("unauthenticated")
  }

  const value = useMemo(
    () => ({ user, status, signIn, signOut }),
    [user, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider.")
  return context
}
