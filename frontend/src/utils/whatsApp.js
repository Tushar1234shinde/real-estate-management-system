/**
 * Utilities for WhatsApp Click-to-Chat (wa.me) integration.
 */

/**
 * Normalizes a customer phone number into international digits format
 * suitable for WhatsApp Click-to-Chat (https://wa.me/<number>).
 *
 * Rules:
 * - Strips non-digit formatting characters (+, -, spaces, parentheses).
 * - Avoids blindly duplicating country code if already present.
 * - Adds default country code (91) for 10-digit national numbers or numbers with trunk 0.
 * - Validates length between 10 and 15 digits (E.164 standard).
 * - Never invents phone numbers.
 *
 * @param {string} rawPhone
 * @param {string} [defaultCountryCode="91"]
 * @returns {string|null} Normalized phone number string, or null if invalid.
 */
export function normalizePhoneNumber(rawPhone, defaultCountryCode = "91") {
  if (!rawPhone || typeof rawPhone !== "string") {
    return null;
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return null;
  }

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  let normalized = digits;

  if (hasLeadingPlus) {
    normalized = digits;
  } else {
    if (digits.length === 10) {
      normalized = `${defaultCountryCode}${digits}`;
    } else if (digits.length === 11 && digits.startsWith("0")) {
      normalized = `${defaultCountryCode}${digits.slice(1)}`;
    } else if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
      normalized = digits;
    } else if (digits.length >= 11 && digits.length <= 15) {
      normalized = digits;
    } else {
      return null;
    }
  }

  normalized = normalized.replace(/^0+/, "");

  if (!/^\d{10,15}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Checks whether a raw phone number can be normalized into a valid WhatsApp recipient number.
 */
export function isValidPhoneNumber(rawPhone, defaultCountryCode = "91") {
  return normalizePhoneNumber(rawPhone, defaultCountryCode) !== null;
}

/**
 * Generates the official WhatsApp Click-to-Chat URL.
 * Format: https://wa.me/<country_code_and_phone_number>?text=<URL_encoded_message>
 *
 * @param {string} phone
 * @param {string} [messageText=""]
 * @param {string} [defaultCountryCode="91"]
 * @returns {string|null} Full wa.me URL, or null if phone is invalid.
 */
export function buildWhatsAppUrl(phone, messageText = "", defaultCountryCode = "91") {
  const normalizedPhone = normalizePhoneNumber(phone, defaultCountryCode);
  if (!normalizedPhone) {
    return null;
  }

  const trimmedMessage = typeof messageText === "string" ? messageText.trim() : "";
  const encodedText = trimmedMessage ? encodeURIComponent(trimmedMessage) : "";

  return encodedText
    ? `https://wa.me/${normalizedPhone}?text=${encodedText}`
    : `https://wa.me/${normalizedPhone}`;
}

/**
 * Opens WhatsApp in a new tab/window for manual employee review and send.
 *
 * @param {string} phone
 * @param {string} [messageText=""]
 * @param {string} [defaultCountryCode="91"]
 * @returns {boolean} True if WhatsApp URL was successfully generated and opened.
 */
export function openWhatsAppChat(phone, messageText = "", defaultCountryCode = "91") {
  const url = buildWhatsAppUrl(phone, messageText, defaultCountryCode);
  if (!url) {
    return false;
  }

  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Scenario A: Customer is Interested
 */
export function getInterestedMessage(customerName = "there", propertyTitle = "the property") {
  return `Hello ${customerName || "there"},

Thank you for showing interest in ${propertyTitle || "the property"}. We appreciate your interest in this property.

Please find the property documents attached for your reference. If you have any questions or would like to know more details, feel free to contact us.

Thank you for considering PropLattice!`;
}

/**
 * Scenario B: Customer is Not Interested
 */
export function getNotInterestedMessage(customerName = "there", propertyTitle = "the property") {
  return `Hello ${customerName || "there"},

Thank you for your valuable time and for considering ${propertyTitle || "the property"}.

We understand that this property may not match your current requirements. If you become interested in this property or need assistance with other properties in the future, please feel free to contact us.

Thank you for your time and consideration!

Team PropLattice`;
}

/**
 * Scenario C: Customer's Interest Status Is Pending
 */
export function getPendingMessage(customerName = "there", propertyTitle = "") {
  if (propertyTitle) {
    return `Hello ${customerName || "there"},

Thank you for contacting PropLattice regarding ${propertyTitle}. Please let us know if you have any questions or if you would like to schedule a site visit.`;
  }
  return `Hello ${customerName || "there"},

Thank you for contacting PropLattice. How can we assist you with your property search today?`;
}

export const WHATSAPP_TEMPLATES = [
  {
    id: "interested",
    label: "Interested (Thank You)",
    title: "Interested Customer Thank-You",
    getText: (cust, prop) => getInterestedMessage(cust?.fullName, prop?.title),
  },
  {
    id: "not_interested",
    label: "Not Interested (Follow-up)",
    title: "Not Interested Follow-up",
    getText: (cust, prop) => getNotInterestedMessage(cust?.fullName, prop?.title),
  },
  {
    id: "follow_up",
    label: "Follow-up",
    title: "Customer Follow-up",
    getText: (cust, prop) =>
      `Hello ${cust?.fullName || "there"}, following up regarding your interest in ${prop?.title ? `${prop.title} with PropLattice` : "properties with PropLattice"}. Please let me know when you would be available for a quick conversation.`,
  },
  {
    id: "property_details",
    label: "Property Details",
    title: "Property Details",
    getText: (cust, prop) =>
      `Hello ${cust?.fullName || "there"}, here are the property details you requested from PropLattice${prop?.title ? ` for ${prop.title}` : ""}. Please let me know if you would like more information or if you would like to schedule a site visit.`,
  },
  {
    id: "visit_confirmation",
    label: "Visit Confirmation",
    title: "Visit Confirmation",
    getText: (cust, prop) =>
      `Hello ${cust?.fullName || "there"}, this is to confirm your upcoming property visit${prop?.title ? ` for ${prop.title}` : ""} with our sales team. Please let us know if you have any questions or need to reschedule.`,
  },
  {
    id: "general_enquiry",
    label: "General Enquiry",
    title: "General Enquiry Response",
    getText: (cust) =>
      `Hello ${cust?.fullName || "there"}, thank you for contacting PropLattice. How can we assist you with your property search today?`,
  },
];
