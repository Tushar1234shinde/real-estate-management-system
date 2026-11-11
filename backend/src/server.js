
import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "../routes/authRoutes.js";
import customerRoutes from "../routes/customerRoutes.js";
import employeeRoutes from "../routes/employeeRoutes.js";
import executiveRoutes from "../routes/executiveRoutes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/executive", executiveRoutes);

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
