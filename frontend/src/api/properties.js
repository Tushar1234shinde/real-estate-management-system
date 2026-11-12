import { apiRequest } from "./client.js"

export const propertiesApi = {
  list: (query, options) => apiRequest("/api/admin/properties", { query, ...options }),
  create: (body, options) => apiRequest("/api/admin/properties", { method: "POST", body, ...options }),
  get: (propertyId, options) => apiRequest(`/api/admin/properties/${propertyId}`, options),
  update: (propertyId, body, options) => apiRequest(`/api/admin/properties/${propertyId}`, { method: "PATCH", body, ...options }),
}
