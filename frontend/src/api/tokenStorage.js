const TOKEN_STORAGE_KEY = "real-estate-api-token"

export function getAuthToken() {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setAuthToken(token) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}
