import { apiRequest } from "./client.js"

export const executiveApi = {
  listEmployees: (query, options) => apiRequest("/api/executive/employees", { query, ...options }),
  createEmployee: (body, options) => apiRequest("/api/executive/employees", { method: "POST", body, ...options }),
  listCustomers: (query, options) => apiRequest("/api/executive/customers", { query, ...options }),
  createCustomer: (body, options) => apiRequest("/api/executive/customers", { method: "POST", body, ...options }),
  assignCustomer: (customerId, insideSalesEmployeeId, options) => apiRequest("/api/executive/assignments", { method: "POST", body: { customerId, insideSalesEmployeeId }, ...options }),
  listCallLogs: (query, options) => apiRequest("/api/admin/call-logs", { query, ...options }),
  getCallLogStatistics: (query, options) => apiRequest("/api/admin/call-logs/statistics", { query, ...options }),
}
