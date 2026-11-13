import { apiRequest } from "./client.js"

export const outsideSalesApi = {
  listVisitSchedules: (query, options) => apiRequest("/api/outside-sales/visit-schedules", { query, ...options }),
  listDocuments: (propertyId, query, options) => apiRequest(`/api/outside-sales/properties/${propertyId}/documents`, { query, ...options }),
  getDocumentAccess: (propertyId, documentId, options) => apiRequest(`/api/outside-sales/properties/${propertyId}/documents/${documentId}/access`, options),
  listCallLogs: (customerId, options) => apiRequest(`/api/outside-sales/customers/${customerId}/call-logs`, options),
  createCallLog: (customerId, body, options) => apiRequest(`/api/outside-sales/customers/${customerId}/call-logs`, { method: "POST", body, ...options }),
}
