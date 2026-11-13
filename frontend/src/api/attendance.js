import { apiRequest } from "./client.js"

export const attendanceApi = {
  checkIn: (body, options) =>
    apiRequest("/api/attendance/check-in", { method: "POST", body, ...options }),
  checkOut: (body, options) =>
    apiRequest("/api/attendance/check-out", { method: "POST", body, ...options }),
  myAttendance: (query, options) =>
    apiRequest("/api/attendance", { query, ...options }),
  myAttendanceForDate: (date, options) =>
    apiRequest(`/api/attendance/date/${date}`, options),
}

export const adminAttendanceApi = {
  listAttendance: (query, options) =>
    apiRequest("/api/admin/attendance", { query, ...options }),
  getAttendanceSummary: (query, options) =>
    apiRequest("/api/admin/attendance/summary", { query, ...options }),
}