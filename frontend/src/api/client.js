import { clearAuthToken, getAuthToken } from "./tokenStorage.js"

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

function createUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`)

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  return url
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return null

  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiRequest(path, { method = "GET", query, body, headers = {}, signal } = {}) {
  const token = getAuthToken()
  const isFormData = body instanceof FormData
  const requestHeaders = new Headers(headers)

  if (token) requestHeaders.set("Authorization", `Bearer ${token}`)
  if (body !== undefined && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  let response
  try {
    response = await fetch(createUrl(path, query), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === "AbortError") throw error
    throw new ApiError("Unable to connect to the API.", { data: error })
  }

  const payload = await readResponse(response)
  if (!response.ok || payload?.success === false) {
    if (response.status === 401) {
      clearAuthToken()
      window.dispatchEvent(new Event("auth:unauthorized"))
    }
    throw new ApiError(payload?.message || "The API request failed.", {
      status: response.status,
      data: payload,
    })
  }

  if (!payload || payload.success !== true) {
    throw new ApiError("The API returned an unexpected response.", {
      status: response.status,
      data: payload,
    })
  }

  return payload.data
}

export { API_BASE_URL }
