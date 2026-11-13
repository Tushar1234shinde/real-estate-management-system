
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.19.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.19.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  fullName: 'fullName',
  email: 'email',
  passwordHash: 'passwordHash',
  phone: 'phone',
  profileImageUrl: 'profileImageUrl',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  fullName: 'fullName',
  email: 'email',
  phone: 'phone',
  address: 'address',
  status: 'status',
  interestStatus: 'interestStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomerAssignmentScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  insideSalesEmployeeId: 'insideSalesEmployeeId',
  assignedByUserId: 'assignedByUserId',
  assignedAt: 'assignedAt',
  status: 'status'
};

exports.Prisma.PropertyScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  location: 'location',
  latitude: 'latitude',
  longitude: 'longitude',
  verificationRadiusMeters: 'verificationRadiusMeters',
  price: 'price',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PropertyDocumentScalarFieldEnum = {
  id: 'id',
  propertyId: 'propertyId',
  uploadedByUserId: 'uploadedByUserId',
  documentName: 'documentName',
  documentUrl: 'documentUrl',
  mimeType: 'mimeType',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.CallLogScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  employeeId: 'employeeId',
  propertyId: 'propertyId',
  outcome: 'outcome',
  notes: 'notes',
  calledAt: 'calledAt'
};

exports.Prisma.VisitScheduleScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  propertyId: 'propertyId',
  insideSalesEmployeeId: 'insideSalesEmployeeId',
  outsideSalesEmployeeId: 'outsideSalesEmployeeId',
  scheduledByUserId: 'scheduledByUserId',
  scheduledAt: 'scheduledAt',
  status: 'status',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.VisitScalarFieldEnum = {
  id: 'id',
  scheduleId: 'scheduleId',
  reachedAt: 'reachedAt',
  completedAt: 'completedAt',
  status: 'status',
  reachedLatitude: 'reachedLatitude',
  reachedLongitude: 'reachedLongitude',
  verificationResult: 'verificationResult',
  verificationCheckedAt: 'verificationCheckedAt',
  verificationDistanceMeters: 'verificationDistanceMeters',
  reviewerId: 'reviewerId',
  reviewedAt: 'reviewedAt',
  rejectionReason: 'rejectionReason'
};

exports.Prisma.MediaAssetScalarFieldEnum = {
  id: 'id',
  visitId: 'visitId',
  uploadedByUserId: 'uploadedByUserId',
  mediaType: 'mediaType',
  fileUrl: 'fileUrl',
  publicId: 'publicId',
  assetId: 'assetId',
  resourceType: 'resourceType',
  deliveryType: 'deliveryType',
  mimeType: 'mimeType',
  fileSizeBytes: 'fileSizeBytes',
  durationSeconds: 'durationSeconds',
  uploadedAt: 'uploadedAt'
};

exports.Prisma.VisitStatusHistoryScalarFieldEnum = {
  id: 'id',
  visitId: 'visitId',
  previousStatus: 'previousStatus',
  newStatus: 'newStatus',
  changedByUserId: 'changedByUserId',
  reason: 'reason',
  changedAt: 'changedAt'
};

exports.Prisma.OfficeLocationScalarFieldEnum = {
  id: 'id',
  officeName: 'officeName',
  address: 'address',
  latitude: 'latitude',
  longitude: 'longitude',
  allowedRadiusMeters: 'allowedRadiusMeters',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AttendanceScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  officeLocationId: 'officeLocationId',
  loginTime: 'loginTime',
  logoutTime: 'logoutTime',
  loginLatitude: 'loginLatitude',
  loginLongitude: 'loginLongitude',
  logoutLatitude: 'logoutLatitude',
  logoutLongitude: 'logoutLongitude',
  status: 'status',
  logoutReason: 'logoutReason'
};

exports.Prisma.WhatsAppMessageLogScalarFieldEnum = {
  id: 'id',
  customerId: 'customerId',
  triggeredByUserId: 'triggeredByUserId',
  messageType: 'messageType',
  messageContent: 'messageContent',
  providerMessageId: 'providerMessageId',
  deliveryStatus: 'deliveryStatus',
  sentAt: 'sentAt',
  createdAt: 'createdAt'
};

exports.Prisma.WhatsAppMessageAttachmentScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  propertyDocumentId: 'propertyDocumentId'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  message: 'message',
  isRead: 'isRead',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.RoleName = exports.$Enums.RoleName = {
  ADMIN: 'ADMIN',
  EXECUTIVE: 'EXECUTIVE',
  INSIDE_SALES: 'INSIDE_SALES',
  OUTSIDE_SALES: 'OUTSIDE_SALES'
};

exports.CustomerStatus = exports.$Enums.CustomerStatus = {
  NEW: 'NEW',
  ASSIGNED: 'ASSIGNED',
  CONTACTED: 'CONTACTED',
  CONVERTED: 'CONVERTED',
  CLOSED: 'CLOSED'
};

exports.CustomerInterestStatus = exports.$Enums.CustomerInterestStatus = {
  PENDING: 'PENDING',
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED'
};

exports.AssignmentStatus = exports.$Enums.AssignmentStatus = {
  ASSIGNED: 'ASSIGNED'
};

exports.PropertyStatus = exports.$Enums.PropertyStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  SOLD: 'SOLD',
  INACTIVE: 'INACTIVE'
};

exports.CallOutcome = exports.$Enums.CallOutcome = {
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  NO_ANSWER: 'NO_ANSWER',
  CALL_BACK: 'CALL_BACK',
  INVALID_NUMBER: 'INVALID_NUMBER'
};

exports.VisitScheduleStatus = exports.$Enums.VisitScheduleStatus = {
  SCHEDULED: 'SCHEDULED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
};

exports.VisitStatus = exports.$Enums.VisitStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

exports.VisitVerificationResult = exports.$Enums.VisitVerificationResult = {
  PENDING: 'PENDING',
  PASSED: 'PASSED',
  FAILED: 'FAILED'
};

exports.MediaType = exports.$Enums.MediaType = {
  AUDIO_RECORDING: 'AUDIO_RECORDING',
  VISIT_SELFIE: 'VISIT_SELFIE',
  CUSTOMER_SELFIE: 'CUSTOMER_SELFIE',
  OTHER: 'OTHER'
};

exports.AttendanceStatus = exports.$Enums.AttendanceStatus = {
  LOGGED_IN: 'LOGGED_IN',
  LOGGED_OUT: 'LOGGED_OUT',
  AUTO_LOGGED_OUT: 'AUTO_LOGGED_OUT'
};

exports.LogoutReason = exports.$Enums.LogoutReason = {
  MANUAL: 'MANUAL',
  GEOFENCE_EXIT: 'GEOFENCE_EXIT',
  ADMIN_ACTION: 'ADMIN_ACTION'
};

exports.WhatsAppMessageType = exports.$Enums.WhatsAppMessageType = {
  INTERESTED_THANK_YOU: 'INTERESTED_THANK_YOU',
  NOT_INTERESTED_FOLLOW_UP: 'NOT_INTERESTED_FOLLOW_UP',
  PROPERTY_DOCUMENT: 'PROPERTY_DOCUMENT',
  GENERAL_UPDATE: 'GENERAL_UPDATE',
  HOLIDAY_MESSAGE: 'HOLIDAY_MESSAGE'
};

exports.MessageDeliveryStatus = exports.$Enums.MessageDeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED'
};

exports.Prisma.ModelName = {
  Role: 'Role',
  User: 'User',
  Customer: 'Customer',
  CustomerAssignment: 'CustomerAssignment',
  Property: 'Property',
  PropertyDocument: 'PropertyDocument',
  CallLog: 'CallLog',
  VisitSchedule: 'VisitSchedule',
  Visit: 'Visit',
  MediaAsset: 'MediaAsset',
  VisitStatusHistory: 'VisitStatusHistory',
  OfficeLocation: 'OfficeLocation',
  Attendance: 'Attendance',
  WhatsAppMessageLog: 'WhatsAppMessageLog',
  WhatsAppMessageAttachment: 'WhatsAppMessageAttachment',
  Notification: 'Notification'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
