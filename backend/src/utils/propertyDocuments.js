import multer from "multer";
import { AppError } from "../errors/AppError.js";

export const PROPERTY_DOCUMENT_MAX_FILES = 5;
export const PROPERTY_DOCUMENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const signatures = {
    "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    "image/png": (buffer) => buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/webp": (buffer) => buffer.length >= 12
        && buffer.subarray(0, 4).toString() === "RIFF"
        && buffer.subarray(8, 12).toString() === "WEBP",
    "application/pdf": (buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString() === "%PDF-",
};

const extensions = Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
});

export function createPropertyDocumentUpload() {
    return multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: PROPERTY_DOCUMENT_MAX_FILE_SIZE_BYTES,
            files: PROPERTY_DOCUMENT_MAX_FILES,
            fields: 2,
            parts: PROPERTY_DOCUMENT_MAX_FILES + 2,
        },
    }).array("files", PROPERTY_DOCUMENT_MAX_FILES);
}

export function propertyDocumentMulterErrorHandler(middleware) {
    return (req, res, next) => middleware(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return next(new AppError(statusCode, "Invalid property document upload."));
        }
        return next(error);
    });
}

function safeOriginalFilename(value) {
    if (typeof value !== "string") {
        throw new AppError(400, "A valid document filename is required.");
    }
    const filename = value.replace(/\\/g, "/").split("/").pop()
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim();
    if (!filename || filename.length > 255) {
        throw new AppError(400, "Document filenames must be between 1 and 255 characters.");
    }
    return filename;
}

export function validatePropertyDocumentFile(file) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.size < 1) {
        throw new AppError(400, "At least one valid property document file is required.");
    }
    const originalFileName = safeOriginalFilename(file.originalname);
    const extension = originalFileName.includes(".")
        ? originalFileName.slice(originalFileName.lastIndexOf(".") + 1).toLowerCase()
        : "";
    const expectedMimeType = extensions[extension];
    if (!expectedMimeType || file.mimetype !== expectedMimeType || !signatures[expectedMimeType](file.buffer)) {
        throw new AppError(400, "Only valid PDF, JPEG, PNG, and WebP documents are supported.");
    }

    return {
        originalFileName,
        extension,
        resourceType: expectedMimeType === "application/pdf" ? "raw" : "image",
    };
}
