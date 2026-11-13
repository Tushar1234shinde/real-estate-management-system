const authorize = (...allowed_roles) => {
    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Please authenticate first"
            });
        }

        if (!allowed_roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission"
            });
        }

        next();
    };
};

module.exports = authorize;