-- Consolidated initial migration for real_estate_db
-- Merges all prior migration history into a single reproducible schema.

-- -------------------- ENUMS --------------------

CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'EXECUTIVE', 'INSIDE_SALES', 'OUTSIDE_SALES');

CREATE TYPE "CustomerInterestStatus" AS ENUM ('PENDING', 'INTERESTED', 'NOT_INTERESTED');

CREATE TYPE "CustomerStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'CONVERTED', 'CLOSED');

CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'SOLD', 'INACTIVE');

CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED');

CREATE TYPE "CallOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALL_BACK', 'INVALID_NUMBER');

CREATE TYPE "VisitScheduleStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

CREATE TYPE "VisitStatus" AS ENUM ('IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TYPE "VisitVerificationResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

CREATE TYPE "MediaType" AS ENUM ('AUDIO_RECORDING', 'VISIT_SELFIE', 'CUSTOMER_SELFIE', 'OTHER');

CREATE TYPE "AttendanceStatus" AS ENUM ('LOGGED_IN', 'LOGGED_OUT', 'AUTO_LOGGED_OUT');

CREATE TYPE "LogoutReason" AS ENUM ('MANUAL', 'GEOFENCE_EXIT', 'ADMIN_ACTION');

CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TYPE "WhatsAppMessageType" AS ENUM ('INTERESTED_THANK_YOU', 'NOT_INTERESTED_FOLLOW_UP', 'PROPERTY_DOCUMENT', 'GENERAL_UPDATE', 'HOLIDAY_MESSAGE');

CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TYPE "WhatsAppOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUBMITTING', 'SENT', 'FAILED', 'CANCELLED', 'UNKNOWN');

CREATE TYPE "WhatsAppConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT');

CREATE TYPE "WhatsAppInboundProcessingClassification" AS ENUM ('NORMAL', 'OPT_OUT', 'OPT_IN', 'STALE_OPT_IN', 'UNMATCHED', 'UNSUPPORTED');

-- -------------------- ROLES & USERS --------------------

CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "profileImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- -------------------- CUSTOMERS --------------------

CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'NEW',
    "interestStatus" "CustomerInterestStatus" NOT NULL DEFAULT 'PENDING',
    "lastWhatsappInboundAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- -------------------- CUSTOMER ASSIGNMENTS --------------------

CREATE TABLE "customer_assignments" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "insideSalesEmployeeId" INTEGER NOT NULL,
    "assignedByUserId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',

    CONSTRAINT "customer_assignments_pkey" PRIMARY KEY ("id")
);

-- -------------------- PROPERTIES --------------------

CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "verificationRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- -------------------- PROPERTY DOCUMENTS --------------------

CREATE TABLE "property_documents" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "publicId" TEXT,
    "assetId" TEXT,
    "resourceType" TEXT,
    "deliveryType" TEXT,
    "fileSizeBytes" BIGINT,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- -------------------- CALL LOGS --------------------

CREATE TABLE "call_logs" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "propertyId" INTEGER,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "calledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- -------------------- VISIT SCHEDULES --------------------

CREATE TABLE "visit_schedules" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "insideSalesEmployeeId" INTEGER NOT NULL,
    "outsideSalesEmployeeId" INTEGER NOT NULL,
    "scheduledByUserId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "VisitScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_schedules_pkey" PRIMARY KEY ("id")
);

-- -------------------- VISITS --------------------

CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "reachedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reachedLatitude" DOUBLE PRECISION,
    "reachedLongitude" DOUBLE PRECISION,
    "verificationResult" "VisitVerificationResult" NOT NULL DEFAULT 'PENDING',
    "verificationCheckedAt" TIMESTAMPTZ(3),
    "verificationDistanceMeters" DOUBLE PRECISION,
    "reviewerId" INTEGER,
    "reviewedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- -------------------- VISIT STATUS HISTORY --------------------

CREATE TABLE "visit_status_history" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "previousStatus" "VisitStatus",
    "newStatus" "VisitStatus" NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_status_history_pkey" PRIMARY KEY ("id")
);

-- -------------------- MEDIA ASSETS --------------------

CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "publicId" TEXT,
    "assetId" TEXT,
    "resourceType" TEXT,
    "deliveryType" TEXT,
    "fileSizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- -------------------- OFFICE LOCATIONS --------------------

CREATE TABLE "office_locations" (
    "id" SERIAL NOT NULL,
    "officeName" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "allowedRadiusMeters" INTEGER NOT NULL DEFAULT 200,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "office_locations_pkey" PRIMARY KEY ("id")
);

-- -------------------- ATTENDANCE --------------------

CREATE TABLE "attendance" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "officeLocationId" INTEGER NOT NULL,
    "loginTime" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMPTZ(3),
    "loginLatitude" DOUBLE PRECISION NOT NULL,
    "loginLongitude" DOUBLE PRECISION NOT NULL,
    "logoutLatitude" DOUBLE PRECISION,
    "logoutLongitude" DOUBLE PRECISION,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'LOGGED_IN',
    "logoutReason" "LogoutReason",

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP MESSAGE LOGS --------------------

CREATE TABLE "whatsapp_message_logs" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "triggeredByUserId" INTEGER,
    "messageType" "WhatsAppMessageType" NOT NULL,
    "messageContent" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMPTZ(3),
    "statusUpdatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP MESSAGE ATTACHMENTS --------------------

CREATE TABLE "whatsapp_message_attachments" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "propertyDocumentId" INTEGER NOT NULL,

    CONSTRAINT "whatsapp_message_attachments_pkey" PRIMARY KEY ("id")
);

-- -------------------- NOTIFICATIONS --------------------

CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP CONSENT EVENTS --------------------

CREATE TABLE "whatsapp_consent_events" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "recordedByUserId" INTEGER,
    "inboundMessageEventId" INTEGER,
    "status" "WhatsAppConsentStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "consentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_consent_events_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP MESSAGE STATUS EVENTS --------------------

CREATE TABLE "whatsapp_message_status_events" (
    "id" SERIAL NOT NULL,
    "messageLogId" INTEGER NOT NULL,
    "status" "MessageDeliveryStatus" NOT NULL,
    "providerTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerErrorCode" TEXT,

    CONSTRAINT "whatsapp_message_status_events_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP INBOUND MESSAGE EVENTS --------------------

CREATE TABLE "whatsapp_inbound_message_events" (
    "id" SERIAL NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "customerId" INTEGER,
    "senderPhone" TEXT NOT NULL,
    "providerTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "messageType" TEXT NOT NULL,
    "processingClassification" "WhatsAppInboundProcessingClassification" NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_inbound_message_events_pkey" PRIMARY KEY ("id")
);

-- -------------------- ANNOUNCEMENTS --------------------

CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMPTZ(3),
    "createdById" INTEGER NOT NULL,
    "targetRoles" "RoleName"[] NOT NULL DEFAULT ARRAY[]::"RoleName"[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- -------------------- ANNOUNCEMENT READS --------------------

CREATE TABLE "announcement_reads" (
    "id" SERIAL NOT NULL,
    "announcementId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP MESSAGE OUTBOX --------------------

CREATE TABLE "whatsapp_message_outbox" (
    "id" SERIAL NOT NULL,
    "messageLogId" INTEGER NOT NULL,
    "status" "WhatsAppOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "claimToken" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMPTZ(3),
    "submissionStartedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "whatsapp_message_outbox_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP MESSAGE IDEMPOTENCY --------------------

CREATE TABLE "whatsapp_message_idempotency" (
    "id" SERIAL NOT NULL,
    "senderUserId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "payloadFingerprint" CHAR(64) NOT NULL,
    "messageLogId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_idempotency_pkey" PRIMARY KEY ("id")
);

-- -------------------- WHATSAPP PENDING STATUS EVENTS --------------------

CREATE TABLE "whatsapp_pending_status_events" (
    "id" SERIAL NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "status" "MessageDeliveryStatus" NOT NULL,
    "providerTimestamp" TIMESTAMPTZ(3) NOT NULL,
    "providerErrorCode" VARCHAR(100),
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_pending_status_events_pkey" PRIMARY KEY ("id")
);

-- -------------------- INDEXES --------------------

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

CREATE INDEX "users_roleId_idx" ON "users"("roleId");

CREATE INDEX "customers_phone_idx" ON "customers"("phone");

CREATE INDEX "customers_status_interestStatus_idx" ON "customers"("status", "interestStatus");

CREATE UNIQUE INDEX "customer_assignments_customerId_key" ON "customer_assignments"("customerId");

CREATE INDEX "customer_assignments_insideSalesEmployeeId_idx" ON "customer_assignments"("insideSalesEmployeeId");

CREATE INDEX "customer_assignments_assignedByUserId_idx" ON "customer_assignments"("assignedByUserId");

CREATE INDEX "properties_status_idx" ON "properties"("status");

CREATE INDEX "property_documents_propertyId_idx" ON "property_documents"("propertyId");

CREATE INDEX "property_documents_uploadedByUserId_idx" ON "property_documents"("uploadedByUserId");

CREATE UNIQUE INDEX "property_documents_publicId_key" ON "property_documents"("publicId");

CREATE UNIQUE INDEX "property_documents_assetId_key" ON "property_documents"("assetId");

CREATE INDEX "call_logs_customerId_calledAt_idx" ON "call_logs"("customerId", "calledAt");

CREATE INDEX "call_logs_employeeId_calledAt_idx" ON "call_logs"("employeeId", "calledAt");

CREATE INDEX "call_logs_propertyId_idx" ON "call_logs"("propertyId");

CREATE INDEX "visit_schedules_outsideSalesEmployeeId_scheduledAt_idx" ON "visit_schedules"("outsideSalesEmployeeId", "scheduledAt");

CREATE INDEX "visit_schedules_insideSalesEmployeeId_idx" ON "visit_schedules"("insideSalesEmployeeId");

CREATE INDEX "visit_schedules_customerId_idx" ON "visit_schedules"("customerId");

CREATE INDEX "visit_schedules_propertyId_idx" ON "visit_schedules"("propertyId");

CREATE INDEX "visit_schedules_scheduledByUserId_idx" ON "visit_schedules"("scheduledByUserId");

CREATE UNIQUE INDEX "visits_scheduleId_key" ON "visits"("scheduleId");

CREATE INDEX "visits_reviewerId_idx" ON "visits"("reviewerId");

CREATE INDEX "media_assets_visitId_mediaType_idx" ON "media_assets"("visitId", "mediaType");

CREATE INDEX "media_assets_uploadedByUserId_idx" ON "media_assets"("uploadedByUserId");

CREATE INDEX "attendance_employeeId_loginTime_idx" ON "attendance"("employeeId", "loginTime");

CREATE INDEX "attendance_officeLocationId_idx" ON "attendance"("officeLocationId");

CREATE UNIQUE INDEX "whatsapp_message_logs_providerMessageId_key" ON "whatsapp_message_logs"("providerMessageId");

CREATE INDEX "whatsapp_message_logs_customerId_createdAt_idx" ON "whatsapp_message_logs"("customerId", "createdAt");

CREATE INDEX "whatsapp_message_logs_deliveryStatus_idx" ON "whatsapp_message_logs"("deliveryStatus");

CREATE INDEX "whatsapp_message_logs_triggeredByUserId_idx" ON "whatsapp_message_logs"("triggeredByUserId");

CREATE INDEX "whatsapp_message_attachments_propertyDocumentId_idx" ON "whatsapp_message_attachments"("propertyDocumentId");

CREATE UNIQUE INDEX "whatsapp_message_attachments_messageId_propertyDocumentId_key" ON "whatsapp_message_attachments"("messageId", "propertyDocumentId");

CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

CREATE INDEX "whatsapp_consent_events_customerId_recordedAt_idx" ON "whatsapp_consent_events"("customerId", "recordedAt");

CREATE INDEX "whatsapp_consent_events_recordedByUserId_idx" ON "whatsapp_consent_events"("recordedByUserId");

CREATE UNIQUE INDEX "whatsapp_message_status_events_messageLogId_status_providerTimestamp_key" ON "whatsapp_message_status_events"("messageLogId", "status", "providerTimestamp");

CREATE INDEX "whatsapp_message_status_events_messageLogId_providerTimestamp_idx" ON "whatsapp_message_status_events"("messageLogId", "providerTimestamp");

CREATE UNIQUE INDEX "whatsapp_inbound_message_events_providerMessageId_key" ON "whatsapp_inbound_message_events"("providerMessageId");

CREATE INDEX "whatsapp_inbound_message_events_customerId_providerTimestamp_idx" ON "whatsapp_inbound_message_events"("customerId", "providerTimestamp");

CREATE INDEX "whatsapp_inbound_message_events_senderPhone_providerTimestamp_idx" ON "whatsapp_inbound_message_events"("senderPhone", "providerTimestamp");

CREATE UNIQUE INDEX "whatsapp_consent_events_inboundMessageEventId_key" ON "whatsapp_consent_events"("inboundMessageEventId");

CREATE INDEX "announcements_isPublished_expiresAt_createdAt_idx" ON "announcements"("isPublished", "expiresAt", "createdAt");

CREATE INDEX "announcements_createdById_idx" ON "announcements"("createdById");

CREATE UNIQUE INDEX "announcement_reads_announcementId_userId_key" ON "announcement_reads"("announcementId", "userId");

CREATE INDEX "announcement_reads_userId_readAt_idx" ON "announcement_reads"("userId", "readAt");

CREATE UNIQUE INDEX "whatsapp_message_outbox_messageLogId_key" ON "whatsapp_message_outbox"("messageLogId");

CREATE UNIQUE INDEX "whatsapp_message_outbox_claimToken_key" ON "whatsapp_message_outbox"("claimToken");

CREATE INDEX "whatsapp_message_outbox_status_createdAt_id_idx" ON "whatsapp_message_outbox"("status", "createdAt", "id");

CREATE INDEX "whatsapp_message_outbox_status_processingStartedAt_idx" ON "whatsapp_message_outbox"("status", "processingStartedAt");

CREATE INDEX "whatsapp_message_outbox_status_submissionStartedAt_idx" ON "whatsapp_message_outbox"("status", "submissionStartedAt");

CREATE INDEX "whatsapp_message_outbox_status_nextAttemptAt_createdAt_id_idx" ON "whatsapp_message_outbox"("status", "nextAttemptAt", "createdAt", "id");

CREATE UNIQUE INDEX "whatsapp_message_idempotency_senderUserId_customerId_idempotencyKey_key" ON "whatsapp_message_idempotency"("senderUserId", "customerId", "idempotencyKey");

CREATE UNIQUE INDEX "whatsapp_message_idempotency_messageLogId_key" ON "whatsapp_message_idempotency"("messageLogId");

CREATE UNIQUE INDEX "whatsapp_pending_status_events_providerMessageId_status_providerTimestamp_key" ON "whatsapp_pending_status_events"("providerMessageId", "status", "providerTimestamp");

CREATE INDEX "whatsapp_pending_status_events_providerMessageId_providerTimestamp_idx" ON "whatsapp_pending_status_events"("providerMessageId", "providerTimestamp");

-- Partial unique index: at most one active attendance session per employee.
-- Prisma schema cannot express PostgreSQL partial unique indexes.
CREATE UNIQUE INDEX "attendance_one_logged_in_per_employee_key"
ON "attendance"("employeeId")
WHERE "status" = 'LOGGED_IN';

-- Partial unique index: no more than one mandatory visit selfie per visit.
CREATE UNIQUE INDEX "media_assets_one_visit_selfie_per_visit_key"
ON "media_assets"("visitId")
WHERE "mediaType" = 'VISIT_SELFIE';

-- -------------------- FOREIGN KEYS --------------------

ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_insideSalesEmployeeId_fkey" FOREIGN KEY ("insideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_insideSalesEmployeeId_fkey" FOREIGN KEY ("insideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_outsideSalesEmployeeId_fkey" FOREIGN KEY ("outsideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_scheduledByUserId_fkey" FOREIGN KEY ("scheduledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visits" ADD CONSTRAINT "visits_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "visit_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visits" ADD CONSTRAINT "visits_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "visit_status_history" ADD CONSTRAINT "visit_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_officeLocationId_fkey" FOREIGN KEY ("officeLocationId") REFERENCES "office_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_attachments" ADD CONSTRAINT "whatsapp_message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_attachments" ADD CONSTRAINT "whatsapp_message_attachments_propertyDocumentId_fkey" FOREIGN KEY ("propertyDocumentId") REFERENCES "property_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_consent_events" ADD CONSTRAINT "whatsapp_consent_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_consent_events" ADD CONSTRAINT "whatsapp_consent_events_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_consent_events" ADD CONSTRAINT "whatsapp_consent_events_inboundMessageEventId_fkey" FOREIGN KEY ("inboundMessageEventId") REFERENCES "whatsapp_inbound_message_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_status_events" ADD CONSTRAINT "whatsapp_message_status_events_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_inbound_message_events" ADD CONSTRAINT "whatsapp_inbound_message_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_outbox" ADD CONSTRAINT "whatsapp_message_outbox_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_idempotency" ADD CONSTRAINT "whatsapp_message_idempotency_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_idempotency" ADD CONSTRAINT "whatsapp_message_idempotency_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_message_idempotency" ADD CONSTRAINT "whatsapp_message_idempotency_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -------------------- DOMAIN INTEGRITY CONSTRAINTS --------------------

-- Property verification configuration integrity. The verification radius is
-- deliberately fixed to 200 metres, rather than merely defaulting to it.
ALTER TABLE "properties"
ADD CONSTRAINT "properties_latitude_range_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "properties_longitude_range_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "properties_coordinates_pair_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
ADD CONSTRAINT "properties_verificationRadiusMeters_fixed_check" CHECK ("verificationRadiusMeters" = 200);

ALTER TABLE "properties"
ADD CONSTRAINT "properties_price_positive_check" CHECK ("price" > 0);

ALTER TABLE "office_locations"
ADD CONSTRAINT "office_locations_allowedRadiusMeters_positive_check" CHECK ("allowedRadiusMeters" > 0),
ADD CONSTRAINT "office_locations_latitude_range_check" CHECK ("latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "office_locations_longitude_range_check" CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "attendance"
ADD CONSTRAINT "attendance_loginLatitude_range_check" CHECK ("loginLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "attendance_loginLongitude_range_check" CHECK ("loginLongitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "attendance_logoutLatitude_range_check" CHECK ("logoutLatitude" IS NULL OR "logoutLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "attendance_logoutLongitude_range_check" CHECK ("logoutLongitude" IS NULL OR "logoutLongitude" BETWEEN -180 AND 180);

ALTER TABLE "visits"
ADD CONSTRAINT "visits_reachedCoordinates_pair_check" CHECK (("reachedLatitude" IS NULL) = ("reachedLongitude" IS NULL)),
ADD CONSTRAINT "visits_reachedLatitude_range_check" CHECK ("reachedLatitude" IS NULL OR "reachedLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "visits_reachedLongitude_range_check" CHECK ("reachedLongitude" IS NULL OR "reachedLongitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "visits_verificationDistanceMeters_nonnegative_check" CHECK ("verificationDistanceMeters" IS NULL OR "verificationDistanceMeters" >= 0);

ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_fileSizeBytes_nonnegative_check" CHECK ("fileSizeBytes" IS NULL OR "fileSizeBytes" >= 0),
ADD CONSTRAINT "media_assets_durationSeconds_nonnegative_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);