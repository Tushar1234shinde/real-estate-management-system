require("dotenv").config();

const app = require("./app");
const prisma = require("./config/database");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await prisma.$connect();

        console.log("PostgreSQL connected successfully");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();