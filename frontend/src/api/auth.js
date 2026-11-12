import { apiRequest } from "./client.js"
import { clearAuthToken, setAuthToken } from "./tokenStorage.js"

export async function login(credentials, options) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: credentials,
    ...options,
  })
  setAuthToken(data.token)
  return data
}

export function getCurrentUser(options) {
  return apiRequest("/api/auth/me", options)
}

export { clearAuthToken as logout }
