import { apiRequest } from "./client.js";

export const officeLocationsApi = {
  listActiveOfficeLocations: (options) =>
    apiRequest("/api/attendance/office-locations", options),
  listAllOfficeLocations: (query, options) =>
    apiRequest("/api/admin/office-locations", { query, ...options }),
  createOfficeLocation: (body, options) =>
    apiRequest("/api/admin/office-locations", { method: "POST", body, ...options }),
  updateOfficeLocation: (id, body, options) =>
    apiRequest(`/api/admin/office-locations/${id}`, { method: "PATCH", body, ...options }),
  toggleOfficeLocationStatus: (id, options) =>
    apiRequest(`/api/admin/office-locations/${id}/toggle`, { method: "PATCH", ...options }),
};
