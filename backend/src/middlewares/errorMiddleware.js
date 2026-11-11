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
    const statusCode = malformedJson ? 400 : error.statusCode ?? error.status ?? 500;
    const message = malformedJson
        ? "Invalid JSON request body."
        : statusCode >= 500 ? "An unexpected error occurred." : error.message;

    if (statusCode >= 500) {
        console.error(error);
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
}
