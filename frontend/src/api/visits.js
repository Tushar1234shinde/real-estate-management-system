import { apiRequest } from "./client.js"

function evidenceForm(file) {
  const body = new FormData()
  body.append("file", file)
  return body
}

export const visitsApi = {
  initialize: (scheduleId, options) => apiRequest(`/api/visit-schedules/${scheduleId}/visit`, { method: "POST", ...options }),
  verifyLocation: (visitId, body, options) => apiRequest(`/api/visits/${visitId}/verify-location`, { method: "POST", body, ...options }),
  uploadSelfie: (visitId, file, options) => apiRequest(`/api/visits/${visitId}/evidence/selfie`, { method: "POST", body: evidenceForm(file), ...options }),
  uploadAudio: (visitId, file, options) => apiRequest(`/api/visits/${visitId}/evidence/audio`, { method: "POST", body: evidenceForm(file), ...options }),
  submit: (visitId, options) => apiRequest(`/api/visits/${visitId}/submit`, { method: "POST", ...options }),
}
