function logServerError(req, statusCode) {
    const event = {
        level: "error",
        event: "request_failed",
        statusCode,
        method: req.method,
    };

    // Deliberately omit all error-derived data plus request paths, headers, bodies,
    // and queries: they may contain credentials, tokens, or signed URLs.
    console.error(JSON.stringify(event));
}

export function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: "Route not found.",
    });
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const malformedJson = error.type === "entity.parse.failed";
    const oversizedBody = error.type === "entity.too.large" || error.status === 413 || error.statusCode === 413;
    const statusCode = malformedJson ? 400 : oversizedBody ? 413 : error.statusCode ?? error.status ?? 500;
    const message = malformedJson
        ? "Invalid JSON request body."
        : oversizedBody ? "Request body is too large."
        : statusCode >= 500 ? "An unexpected error occurred." : error.message;

    if (statusCode >= 500) {
        logServerError(req, statusCode);
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
}
