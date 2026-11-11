import multer from "multer";
import { AppError } from "../errors/AppError.js";

const DEFAULT_SELFIE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_AUDIO_SIZE_BYTES = 15 * 1024 * 1024;

const signatures = {
    jpeg: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    png: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp: (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP",
    mp3: (buffer) => buffer.length >= 3 && (buffer.subarray(0, 3).toString() === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)),
    wav: (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WAVE",
    ogg: (buffer) => buffer.length >= 4 && buffer.subarray(0, 4).toString() === "OggS",
    webm: (buffer) => buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
    mp4: (buffer) => buffer.length >= 12 && buffer.subarray(4, 8).toString() === "ftyp",
};

const allowedFiles = {
    selfie: {
        "image/jpeg": signatures.jpeg,
        "image/png": signatures.png,
        "image/webp": signatures.webp,
    },
    audio: {
        "audio/mpeg": signatures.mp3,
        "audio/wav": signatures.wav,
        "audio/x-wav": signatures.wav,
        "audio/ogg": signatures.ogg,
        "audio/webm": signatures.webm,
        "audio/mp4": signatures.mp4,
        "audio/x-m4a": signatures.mp4,
    },
};

function parseLimit(value, fallback, variableName) {
    if (value === undefined || value === "") return fallback;
    if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${variableName} must be a positive integer.`);
    }
    return Number(value);
}

export function getEvidenceUploadLimits(environment = process.env) {
    return {
        selfie: parseLimit(environment.SELFIE_MAX_FILE_SIZE_BYTES, DEFAULT_SELFIE_SIZE_BYTES, "SELFIE_MAX_FILE_SIZE_BYTES"),
        audio: parseLimit(environment.AUDIO_MAX_FILE_SIZE_BYTES, DEFAULT_AUDIO_SIZE_BYTES, "AUDIO_MAX_FILE_SIZE_BYTES"),
    };
}

export function createEvidenceUpload(kind, environment = process.env) {
    const limits = getEvidenceUploadLimits(environment);
    return multer({ storage: multer.memoryStorage(), limits: { fileSize: limits[kind], files: 1 } }).single("file");
}

export function validateEvidenceFile(file, kind) {
    if (!file) throw new AppError(400, "A file is required.");
    const signature = allowedFiles[kind]?.[file.mimetype];

    if (!signature || !signature(file.buffer)) {
        throw new AppError(400, `Invalid ${kind} file type.`);
    }
}

export function multerErrorHandler(middleware) {
    return (req, res, next) => middleware(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            return next(new AppError(statusCode, "Invalid evidence upload."));
        }
        return next(error);
    });
}
