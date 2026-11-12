import { apiRequest } from "./client.js"

export const insideSalesApi = {
  listCustomers: (query, options) => apiRequest("/api/inside-sales/customers", { query, ...options }),
  getCustomer: (customerId, options) => apiRequest(`/api/inside-sales/customers/${customerId}`, options),
  listCallLogs: (customerId, options) => apiRequest(`/api/inside-sales/customers/${customerId}/call-logs`, options),
  createCallLog: (customerId, body, options) => apiRequest(`/api/inside-sales/customers/${customerId}/call-logs`, { method: "POST", body, ...options }),
  updateInterest: (customerId, interestStatus, options) => apiRequest(`/api/inside-sales/customers/${customerId}/interest`, { method: "PATCH", body: { interestStatus }, ...options }),
  listAvailableProperties: (query, options) => apiRequest("/api/inside-sales/properties", { query, ...options }),
  listVisitSchedules: (query, options) => apiRequest("/api/inside-sales/visit-schedules", { query, ...options }),
  createVisitSchedule: (body, options) => apiRequest("/api/inside-sales/visit-schedules", { method: "POST", body, ...options }),
  updateVisitSchedule: (scheduleId, body, options) => apiRequest(`/api/inside-sales/visit-schedules/${scheduleId}`, { method: "PATCH", body, ...options }),
  getDashboard: (options) => apiRequest("/api/inside-sales/dashboard", options),
  getProfile: (options) => apiRequest("/api/inside-sales/profile", options),
}
