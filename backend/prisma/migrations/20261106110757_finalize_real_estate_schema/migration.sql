-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'EXECUTIVE', 'INSIDE_SALES', 'OUTSIDE_SALES');

-- CreateEnum
CREATE TYPE "CustomerInterestStatus" AS ENUM ('PENDING', 'INTERESTED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('NEW', 'ASSIGNED', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'SOLD', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALL_BACK', 'INVALID_NUMBER');

-- CreateEnum
CREATE TYPE "VisitScheduleStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('AUDIO_RECORDING', 'CUSTOMER_SELFIE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('LOGGED_IN', 'LOGGED_OUT', 'AUTO_LOGGED_OUT');

-- CreateEnum
CREATE TYPE "LogoutReason" AS ENUM ('MANUAL', 'GEOFENCE_EXIT', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('INTERESTED_THANK_YOU', 'NOT_INTERESTED_FOLLOW_UP', 'PROPERTY_DOCUMENT', 'GENERAL_UPDATE', 'HOLIDAY_MESSAGE');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'NEW',
    "interestStatus" "CustomerInterestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_assignments" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "insideSalesEmployeeId" INTEGER NOT NULL,
    "assignedByUserId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',

    CONSTRAINT "customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_documents" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "reachedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "status" "VisitStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reachedLatitude" DOUBLE PRECISION,
    "reachedLongitude" DOUBLE PRECISION,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" SERIAL NOT NULL,
    "visitId" INTEGER NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "triggeredByUserId" INTEGER,
    "messageType" "WhatsAppMessageType" NOT NULL,
    "messageContent" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_attachments" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "propertyDocumentId" INTEGER NOT NULL,

    CONSTRAINT "whatsapp_message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "users"("roleId");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_status_interestStatus_idx" ON "customers"("status", "interestStatus");

-- CreateIndex
CREATE UNIQUE INDEX "customer_assignments_customerId_key" ON "customer_assignments"("customerId");

-- CreateIndex
CREATE INDEX "customer_assignments_insideSalesEmployeeId_idx" ON "customer_assignments"("insideSalesEmployeeId");

-- CreateIndex
CREATE INDEX "customer_assignments_assignedByUserId_idx" ON "customer_assignments"("assignedByUserId");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "property_documents_propertyId_idx" ON "property_documents"("propertyId");

-- CreateIndex
CREATE INDEX "property_documents_uploadedByUserId_idx" ON "property_documents"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "call_logs_customerId_calledAt_idx" ON "call_logs"("customerId", "calledAt");

-- CreateIndex
CREATE INDEX "call_logs_employeeId_calledAt_idx" ON "call_logs"("employeeId", "calledAt");

-- CreateIndex
CREATE INDEX "call_logs_propertyId_idx" ON "call_logs"("propertyId");

-- CreateIndex
CREATE INDEX "visit_schedules_outsideSalesEmployeeId_scheduledAt_idx" ON "visit_schedules"("outsideSalesEmployeeId", "scheduledAt");

-- CreateIndex
CREATE INDEX "visit_schedules_insideSalesEmployeeId_idx" ON "visit_schedules"("insideSalesEmployeeId");

-- CreateIndex
CREATE INDEX "visit_schedules_customerId_idx" ON "visit_schedules"("customerId");

-- CreateIndex
CREATE INDEX "visit_schedules_propertyId_idx" ON "visit_schedules"("propertyId");

-- CreateIndex
CREATE INDEX "visit_schedules_scheduledByUserId_idx" ON "visit_schedules"("scheduledByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "visits_scheduleId_key" ON "visits"("scheduleId");

-- CreateIndex
CREATE INDEX "media_assets_visitId_mediaType_idx" ON "media_assets"("visitId", "mediaType");

-- CreateIndex
CREATE INDEX "media_assets_uploadedByUserId_idx" ON "media_assets"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "attendance_employeeId_loginTime_idx" ON "attendance"("employeeId", "loginTime");

-- CreateIndex
CREATE INDEX "attendance_officeLocationId_idx" ON "attendance"("officeLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_logs_providerMessageId_key" ON "whatsapp_message_logs"("providerMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_customerId_createdAt_idx" ON "whatsapp_message_logs"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_deliveryStatus_idx" ON "whatsapp_message_logs"("deliveryStatus");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_triggeredByUserId_idx" ON "whatsapp_message_logs"("triggeredByUserId");

-- CreateIndex
CREATE INDEX "whatsapp_message_attachments_propertyDocumentId_idx" ON "whatsapp_message_attachments"("propertyDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_attachments_messageId_propertyDocumentId_key" ON "whatsapp_message_attachments"("messageId", "propertyDocumentId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_insideSalesEmployeeId_fkey" FOREIGN KEY ("insideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_insideSalesEmployeeId_fkey" FOREIGN KEY ("insideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_outsideSalesEmployeeId_fkey" FOREIGN KEY ("outsideSalesEmployeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_schedules" ADD CONSTRAINT "visit_schedules_scheduledByUserId_fkey" FOREIGN KEY ("scheduledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "visit_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_officeLocationId_fkey" FOREIGN KEY ("officeLocationId") REFERENCES "office_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_attachments" ADD CONSTRAINT "whatsapp_message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_message_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_attachments" ADD CONSTRAINT "whatsapp_message_attachments_propertyDocumentId_fkey" FOREIGN KEY ("propertyDocumentId") REFERENCES "property_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce at most one active attendance session per employee. Prisma schema
-- cannot express PostgreSQL partial unique indexes.
CREATE UNIQUE INDEX "attendance_one_logged_in_per_employee_key"
ON "attendance"("employeeId")
WHERE "status" = 'LOGGED_IN';

-- Domain integrity constraints that Prisma schema cannot express.
ALTER TABLE "properties"
ADD CONSTRAINT "properties_price_positive_check" CHECK ("price" > 0);

ALTER TABLE "office_locations"
ADD CONSTRAINT "office_locations_allowedRadiusMeters_positive_check" CHECK ("allowedRadiusMeters" > 0),
ADD CONSTRAINT "office_locations_latitude_range_check" CHECK ("latitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "office_locations_longitude_range_check" CHECK ("longitude" BETWEEN -180 AND 180);

ALTER TABLE "attendance"
ADD CONSTRAINT "attendance_loginLatitude_range_check" CHECK ("loginLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "attendance_loginLongitude_range_check" CHECK ("loginLongitude" BETWEEN -180 AND 180),
ADD CONSTRAINT "attendance_logoutLatitude_range_check" CHECK ("logoutLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "attendance_logoutLongitude_range_check" CHECK ("logoutLongitude" BETWEEN -180 AND 180);

ALTER TABLE "visits"
ADD CONSTRAINT "visits_reachedLatitude_range_check" CHECK ("reachedLatitude" BETWEEN -90 AND 90),
ADD CONSTRAINT "visits_reachedLongitude_range_check" CHECK ("reachedLongitude" BETWEEN -180 AND 180);

ALTER TABLE "media_assets"
ADD CONSTRAINT "media_assets_fileSizeBytes_nonnegative_check" CHECK ("fileSizeBytes" >= 0),
ADD CONSTRAINT "media_assets_durationSeconds_nonnegative_check" CHECK ("durationSeconds" >= 0);
