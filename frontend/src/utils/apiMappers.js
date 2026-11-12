const enumLabels = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  INSIDE_SALES: "Inside Sales",
  OUTSIDE_SALES: "Outside Sales",
  NOT_INTERESTED: "Not interested",
  NO_ANSWER: "No answer",
  CALL_BACK: "Call back",
  PENDING_REVIEW: "Pending review",
  IN_PROGRESS: "In progress",
}

export function enumLabel(value) {
  return enumLabels[value] || String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function toNumericId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function formatDate(value, options = {}) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...options }).format(date)
}

export function formatDateTime(value, options = {}) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", ...options }).format(date)
}

export function mapEmployeeForDisplay(employee) {
  return {
    ...employee,
    id: toNumericId(employee?.id),
    name: employee?.fullName || employee?.name || "",
    roleLabel: enumLabel(employee?.role?.name || employee?.role),
    createdAtLabel: formatDate(employee?.createdAt),
  }
}

export function mapCustomerForDisplay(customer) {
  return {
    ...customer,
    id: toNumericId(customer?.id),
    name: customer?.fullName || "",
    statusLabel: enumLabel(customer?.status),
    interestStatusLabel: enumLabel(customer?.interestStatus),
    createdAtLabel: formatDate(customer?.createdAt),
  }
}

export function mapPropertyForDisplay(property) {
  return {
    ...property,
    id: toNumericId(property?.id),
    price: property?.price == null ? null : String(property.price),
    statusLabel: enumLabel(property?.status),
    createdAtLabel: formatDate(property?.createdAt),
  }
}

export function mapVisitScheduleForDisplay(schedule) {
  return {
    ...schedule,
    id: toNumericId(schedule?.id),
    statusLabel: enumLabel(schedule?.status),
    scheduledAtLabel: formatDateTime(schedule?.scheduledAt),
  }
}
