const authService = require("./auth.service");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const result = await authService.login(email, password);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });

    } catch (error) {

        const error_message = error.message || "Internal server error";

        const status_code =
            error_message === "Your account is inactive" ||
            error_message.startsWith("You are not authorized")
                ? 403
                : error_message === "Invalid email or password"
                    ? 401
                    : 500;

        return res.status(status_code).json({
            success: false,
            message: error_message
        });
    }
};

module.exports = { login };