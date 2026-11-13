const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
    try {
        const auth_header = req.headers.authorization;

        if (!auth_header || !auth_header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication token required"
            });
        }

        const token = auth_header.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = {
            id: Number(decoded.sub),
            role: decoded.role
        };

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = authenticate;