import { apiRequest } from "./client.js"

export const executiveApi = {
  getDashboard: (options) => apiRequest("/api/executive/dashboard", options),
  getProfile: (options) => apiRequest("/api/executive/profile", options),
  listEmployees: (query, options) => apiRequest("/api/executive/employees", { query, ...options }),
  createEmployee: (body, options) => apiRequest("/api/executive/employees", { method: "POST", body, ...options }),
  listCustomers: (query, options) => apiRequest("/api/executive/customers", { query, ...options }),
  createCustomer: (body, options) => apiRequest("/api/executive/customers", { method: "POST", body, ...options }),
  importCustomers: (customers, options) => apiRequest("/api/executive/customers/import", { method: "POST", body: { customers }, ...options }),
  assignCustomer: (customerId, insideSalesEmployeeId, options) => apiRequest("/api/executive/assignments", { method: "POST", body: { customerId, insideSalesEmployeeId }, ...options }),
  uploadEmployeeProfileImage: (file, options) => { const formData = new FormData(); formData.append("file", file); return apiRequest("/api/admin/employees/upload-profile-image", { method: "POST", body: formData, ...options }); },
  listCallLogs: (query, options) => apiRequest("/api/admin/call-logs", { query, ...options }),
  getCallLogStatistics: (query, options) => apiRequest("/api/admin/call-logs/statistics", { query, ...options }),
  listDocuments: (propertyId, query, options) => apiRequest(`/api/admin/properties/${propertyId}/documents`, { query, ...options }),
  uploadDocuments: (propertyId, formData, options) => apiRequest(`/api/admin/properties/${propertyId}/documents`, { method: "POST", body: formData, ...options }),
  getDocumentAccess: (propertyId, documentId, options) => apiRequest(`/api/admin/properties/${propertyId}/documents/${documentId}/access`, options),
  deleteDocument: (propertyId, documentId, options) => apiRequest(`/api/admin/properties/${propertyId}/documents/${documentId}`, { method: "DELETE", ...options }),
}
