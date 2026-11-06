
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check API
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Real Estate Management System API is running!"
    });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
