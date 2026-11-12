import { apiRequest } from "./client.js"

export const outsideSalesApi = {
  listVisitSchedules: (query, options) => apiRequest("/api/outside-sales/visit-schedules", { query, ...options }),
}
