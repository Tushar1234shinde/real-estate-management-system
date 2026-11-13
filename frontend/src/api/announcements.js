import { apiRequest } from "./client.js"

export const announcementsApi = {
  list: (query, options) =>
    apiRequest("/api/announcements", { query, ...options }),
  create: (body, options) =>
    apiRequest("/api/announcements", { method: "POST", body, ...options }),
  get: (announcementId, options) =>
    apiRequest(`/api/announcements/${announcementId}`, options),
  update: (announcementId, body, options) =>
    apiRequest(`/api/announcements/${announcementId}`, {
      method: "PATCH",
      body,
      ...options,
    }),
  remove: (announcementId, options) =>
    apiRequest(`/api/announcements/${announcementId}`, {
      method: "DELETE",
      ...options,
    }),
  markRead: (announcementId, options) =>
    apiRequest(`/api/announcements/${announcementId}/read`, {
      method: "POST",
      ...options,
    }),
}

export const adminAnnouncementsApi = {
  getReadStatistics: (announcementId, options) =>
    apiRequest(
      `/api/admin/announcements/${announcementId}/read-statistics`,
      options
    ),
}