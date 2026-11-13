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

export async function apiRequest(path, { method = "GET", query, body, headers = {}, signal, onUploadProgress } = {}) {
  const token = getAuthToken()
  const isFormData = body instanceof FormData
  const url = createUrl(path, query)

  // Use XMLHttpRequest when upload progress tracking is needed (fetch doesn't support it)
  if (onUploadProgress && isFormData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url.toString())
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onUploadProgress(event)
        }
      })

      xhr.addEventListener("load", () => {
        const contentType = xhr.getResponseHeader("content-type") || ""
        let payload = null
        if (contentType.includes("application/json")) {
          try { payload = JSON.parse(xhr.responseText) } catch { payload = null }
        }

        if (!xhr.ok || (payload && payload.success === false)) {
          if (xhr.status === 401) {
            clearAuthToken()
            window.dispatchEvent(new Event("auth:unauthorized"))
          }
          reject(new ApiError(payload?.message || "The API request failed.", {
            status: xhr.status,
            data: payload,
          }))
          return
        }

        if (!payload || payload.success !== true) {
          reject(new ApiError("The API returned an unexpected response.", {
            status: xhr.status,
            data: payload,
          }))
          return
        }

        resolve(payload.data)
      })

      xhr.addEventListener("error", () => {
        reject(new ApiError("Unable to connect to the API."))
      })

      xhr.addEventListener("abort", () => {
        reject(new ApiError("Request aborted."))
      })

      if (signal) {
        signal.addEventListener("abort", () => xhr.abort())
      }

      xhr.send(body)
    })
  }

  const requestHeaders = new Headers(headers)

  if (token) requestHeaders.set("Authorization", `Bearer ${token}`)
  if (body !== undefined && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  let response
  try {
    response = await fetch(url, {
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
