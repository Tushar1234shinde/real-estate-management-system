# Real Estate Management System API

All endpoints are JSON APIs. Protected endpoints require a valid bearer token:
`Authorization: Bearer <token>`. Responses use `{ "success": true, "data": ... }`;
errors use the existing API error format.

## Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Authenticate an employee |
| GET | `/api/auth/me` | Authenticated | Get the current employee's safe profile |

## Executive-specific management endpoints

These endpoints require the `EXECUTIVE` role. They reuse the same validation,
business rules, and safe response mappings as the corresponding shared Admin
management operations.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/executive/employees` | Paginated employee list |
| POST | `/api/executive/employees` | Create an INSIDE_SALES or OUTSIDE_SALES employee |
| GET | `/api/executive/customers` | Paginated customer list |
| POST | `/api/executive/customers` | Create a NEW, unassigned customer |
| POST | `/api/executive/assignments` | Permanently assign an unassigned customer |

### Executive request contracts

- Employee list accepts `page`, `pageSize`, `role`, and `isActive` query
  parameters. Employee creation accepts `fullName`, `email`, `password`,
  `role`, and optional `phone` and `profileImageUrl`. Only
  `INSIDE_SALES` and `OUTSIDE_SALES` are permitted roles.
- Customer list accepts `page`, `pageSize`, `status`, and `interestStatus`
  query parameters. Customer creation accepts `fullName`, `phone`, and
  optional `email`, `address`, `status`, and `interestStatus`. New customers
  must have status `NEW`; omitted interest status defaults to `PENDING`.
- Assignment creation accepts numeric `customerId` and
  `insideSalesEmployeeId` in the JSON body, for example:

  ```json
  {
    "customerId": 123,
    "insideSalesEmployeeId": 456
  }
  ```

  The target must be an active INSIDE_SALES employee. The customer must not
  already have an assignment. The authenticated Executive is recorded as the
  assigner; caller-supplied assigner identity is not accepted. Success returns
  HTTP 201 with `data.assignment`; invalid targets return 400, missing
  customers return 404, and already-assigned customers return 409.

## Shared Admin management endpoints

These endpoints remain under `/api/admin` for backward compatibility and allow
both `ADMIN` and `EXECUTIVE`, subject to operation-specific restrictions.

### Employees

| Method | Endpoint | Access and purpose |
|---|---|---|
| GET | `/api/admin/employees` | ADMIN and EXECUTIVE: paginated list |
| GET | `/api/admin/employees/:employeeId` | ADMIN and EXECUTIVE: employee details |
| POST | `/api/admin/employees` | ADMIN: any valid role; EXECUTIVE: INSIDE_SALES or OUTSIDE_SALES only |
| PATCH | `/api/admin/employees/:employeeId` | ADMIN: profile, role, and password; EXECUTIVE: name, phone, and image URL only |
| PATCH | `/api/admin/employees/:employeeId/status` | ADMIN only; permanent assignments prevent deactivating or changing the role of an INSIDE_SALES employee |

### Customers and assignments

| Method | Endpoint | Access and purpose |
|---|---|---|
| GET | `/api/admin/customers` | ADMIN and EXECUTIVE: paginated list |
| POST | `/api/admin/customers` | ADMIN and EXECUTIVE: create an unassigned NEW customer |
| GET | `/api/admin/customers/:customerId` | ADMIN and EXECUTIVE: customer details |
| PATCH | `/api/admin/customers/:customerId` | ADMIN and EXECUTIVE: update customer details consistent with assignment state |
| GET | `/api/admin/customers/:customerId/assignment` | ADMIN and EXECUTIVE: read assignment details |
| POST | `/api/admin/customers/:customerId/assignment` | ADMIN and EXECUTIVE: permanently assign an unassigned customer |

The Admin assignment endpoint accepts `insideSalesEmployeeId` in its JSON
body; customer identity is the `:customerId` path parameter. Both assignment
endpoints use the same transaction, active-employee validation, permanent
assignment rule, authenticated assigner identity, and conflict handling.

## Shared properties, dashboard, profile, and visit review

These `/api/admin` endpoints are available to both `ADMIN` and `EXECUTIVE`.
They are shared APIs; no duplicate `/api/executive` routes are required.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/properties` | Paginated property list with filters |
| POST | `/api/admin/properties` | Create a property |
| GET | `/api/admin/properties/:propertyId` | Property details |
| PATCH | `/api/admin/properties/:propertyId` | Update property details |
| POST | `/api/admin/properties/:propertyId/documents` | ADMIN and EXECUTIVE: upload 1–5 private PDF, JPEG, PNG, or WebP files using multipart field `files` (10 MiB per file) |
| GET | `/api/admin/properties/:propertyId/documents` | ADMIN and EXECUTIVE: paginated document metadata |
| GET | `/api/admin/properties/:propertyId/documents/:documentId/access` | ADMIN and EXECUTIVE: short-lived authenticated Cloudinary download URL |
| DELETE | `/api/admin/properties/:propertyId/documents/:documentId` | ADMIN and EXECUTIVE: delete an unattached private document |
| GET | `/api/admin/dashboard` | Portfolio-wide dashboard statistics |
| GET | `/api/admin/profile` | Current user's safe profile |
| GET | `/api/admin/visits/pending-review` | List visits awaiting review |
| GET | `/api/admin/visits/:visitId/review` | Visit review details |
| GET | `/api/admin/visits/:visitId/evidence/:mediaId/access` | Access visit evidence |
| PATCH | `/api/admin/visits/:visitId/approve` | Approve a visit |
| PATCH | `/api/admin/visits/:visitId/reject` | Reject a visit |

Inside Sales can list documents or request a short-lived access URL only for
properties currently offered as `AVAILABLE`. Outside Sales can do so only for
properties in their assigned visit-schedule workflow:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/inside-sales/properties/:propertyId/documents` | List documents for an available property |
| GET | `/api/inside-sales/properties/:propertyId/documents/:documentId/access` | Request short-lived document access |
| GET | `/api/outside-sales/properties/:propertyId/documents` | List documents for a property in an assigned schedule |
| GET | `/api/outside-sales/properties/:propertyId/documents/:documentId/access` | Request short-lived document access |

Document listings omit Cloudinary URLs and identifiers. Access URLs are
authenticated, attachment-only downloads that expire after five minutes.
INSIDE_SALES and OUTSIDE_SALES cannot upload or delete documents. Documents
referenced by a WhatsApp message attachment cannot be deleted.

## Other workflow APIs

Sales, visit scheduling, evidence submission, and attendance endpoints remain
under their existing `/api/inside-sales`, `/api/outside-sales`,
`/api/visit-schedules`, and `/api/visits` prefixes and retain their existing
role permissions and contracts.

## Meta WhatsApp messaging

The Meta webhook routes are public but require webhook verification:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/webhooks/whatsapp` | Verify the Meta webhook subscription |
| POST | `/api/webhooks/whatsapp` | Process signed inbound-message and delivery-status events |

Inside Sales may record consent, send text, and view paginated message history
only for assigned customers. ADMIN and EXECUTIVE may perform the same
operations for any customer. OUTSIDE_SALES has no WhatsApp access.

| Method | Endpoint | Purpose |
|---|---|---|
| PATCH | `/api/inside-sales/customers/:customerId/whatsapp-consent` | Record a customer-requested opt-out |
| POST | `/api/inside-sales/customers/:customerId/whatsapp-messages` | Send text to an assigned customer |
| GET | `/api/inside-sales/customers/:customerId/whatsapp-messages` | List paginated message history |
| PATCH | `/api/admin/customers/:customerId/whatsapp-consent` | Record a customer-requested opt-out |
| POST | `/api/admin/customers/:customerId/whatsapp-messages` | Send text to a customer |
| GET | `/api/admin/customers/:customerId/whatsapp-messages` | List paginated message history |

The consent endpoint accepts only `{ "consented": false, "source": "CUSTOMER_REQUEST" }`
for staff-recorded opt-outs. Staff-submitted opt-ins are rejected. An inbound
customer text containing only `START` or `UNSTOP` (ignoring case, surrounding
whitespace, Unicode compatibility forms, and trailing `!`, `?`, or `.`) records
the customer's opt-in with the signed webhook timestamp. Exact `STOP`,
`STOPALL`, `STOP ALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, and `QUIT` commands
record an opt-out; unrelated text is not treated as consent.

Inbound events are deduplicated by Meta's message ID and retain sender, time,
type, matched customer, and processing classification—not the message body.
Message requests accept `{ "messageContent": "..." }`. The API atomically
creates a message log and a `PENDING` outbox record, then returns HTTP 202 with
`queued: true` and `acceptedByProvider: false`. A database-backed dispatcher
rechecks the latest opt-in and the 24-hour service window before submission.
Free-form messages outside the service window are rejected; approved-template
sending is not implemented.

Clients may include an `Idempotency-Key` header (1–128 URL-safe characters)
when submitting a message. The key is scoped to the authenticated sender and
customer. Retrying the same key with the same normalized message content
returns the original message and outbox state without creating another send;
reusing the key with different content returns HTTP 409. The header remains
optional for compatibility, but clients must use it to make network retries
safe.

The dispatch boundary is the short transaction that moves an outbox record
from `PROCESSING` to `SUBMITTING` while holding the customer row lock and
rechecking consent and the service window. An opt-out committed before that
transition cancels the queued message. Once the transition commits, the
message is in flight and an opt-out cannot guarantee it will be stopped; a
message already accepted by Meta cannot be recalled. The dispatcher performs
the Meta HTTP request outside all database transactions and customer locks.
Definitive provider rejections become `FAILED`; timeouts, connection failures,
and stale `SUBMITTING` records become `UNKNOWN` and are never automatically
resent. Stale `PROCESSING` claims are safe to return to `PENDING` because the
dispatcher has not crossed the submission boundary. Such claims use
exponential backoff, capped at 60 seconds, and are marked `FAILED` after five
claims; stale `SUBMITTING` records become `UNKNOWN` and are never retried.
Signed delivery-status webhooks received before provider-ID persistence are
stored as minimal pending events and reconciled transactionally when the
provider ID is saved. `SENT` means accepted by Meta, not delivered; delivery
status is updated by signed webhook notifications.

The application can verify the customer's sender number and signed inbound
webhook, but cannot independently establish whether an employee-recorded
`CUSTOMER_REQUEST` opt-out claim was genuine. A customer's inbound `START` or
`UNSTOP` is the only supported opt-in/re-consent evidence.

Configure these environment-variable names in the local environment or secret
store: `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`,
`META_WHATSAPP_VERIFY_TOKEN`, `META_WHATSAPP_APP_SECRET`, and
`META_GRAPH_API_VERSION`. A WhatsApp Business Account ID is not required by
the implemented send and webhook operations.

## Security

- Authentication uses JWT bearer tokens and authorization uses the role stored
  for the authenticated user.
- Employee and customer payloads are validated and response mappings omit
  sensitive fields such as password hashes.
- Employee passwords are hashed before storage.
- Customer assignment is permanent; reassignment is not supported.
