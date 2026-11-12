import { apiRequest } from "./client.js"

export const adminApi = {
  getDashboard: (options) => apiRequest("/api/admin/dashboard", options),
  getProfile: (options) => apiRequest("/api/admin/profile", options),
  listEmployees: (query, options) => apiRequest("/api/admin/employees", { query, ...options }),
  createEmployee: (body, options) => apiRequest("/api/admin/employees", { method: "POST", body, ...options }),
  getEmployee: (employeeId, options) => apiRequest(`/api/admin/employees/${employeeId}`, options),
  updateEmployee: (employeeId, body, options) => apiRequest(`/api/admin/employees/${employeeId}`, { method: "PATCH", body, ...options }),
  updateEmployeeStatus: (employeeId, isActive, options) => apiRequest(`/api/admin/employees/${employeeId}/status`, { method: "PATCH", body: { isActive }, ...options }),
  listCustomers: (query, options) => apiRequest("/api/admin/customers", { query, ...options }),
  createCustomer: (body, options) => apiRequest("/api/admin/customers", { method: "POST", body, ...options }),
  getCustomer: (customerId, options) => apiRequest(`/api/admin/customers/${customerId}`, options),
  updateCustomer: (customerId, body, options) => apiRequest(`/api/admin/customers/${customerId}`, { method: "PATCH", body, ...options }),
  getCustomerAssignment: (customerId, options) => apiRequest(`/api/admin/customers/${customerId}/assignment`, options),
  assignCustomer: (customerId, insideSalesEmployeeId, options) => apiRequest(`/api/admin/customers/${customerId}/assignment`, { method: "POST", body: { insideSalesEmployeeId }, ...options }),
  listPendingVisitReviews: (query, options) => apiRequest("/api/admin/visits/pending-review", { query, ...options }),
  getVisitReview: (visitId, options) => apiRequest(`/api/admin/visits/${visitId}/review`, options),
  getEvidenceAccess: (visitId, mediaId, options) => apiRequest(`/api/admin/visits/${visitId}/evidence/${mediaId}/access`, options),
  approveVisit: (visitId, options) => apiRequest(`/api/admin/visits/${visitId}/approve`, { method: "PATCH", ...options }),
  rejectVisit: (visitId, rejectionReason, options) => apiRequest(`/api/admin/visits/${visitId}/reject`, { method: "PATCH", body: { rejectionReason }, ...options }),
}
