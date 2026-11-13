const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");

const adminRoutes = require("./modules/admin/admin.routes");

const executiveRoutes = require("./modules/executive/executive.route");

const {
    adminCustomerRouter,
    executiveCustomerRouter,
    executiveAssignmentRouter
} = require("./modules/customers/customer.routes");

const app = express();
console.log("LOADED: backend/src/app.js");

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());

// app.get("/api/health", (req, res) => {
//     res.status(200).json({
//         success: true,
//         message: "Backend is running"
//     });
// });
app.get("/api/health", (req, res) => {
    console.log("HEALTH ROUTE HIT");

    res.status(200).json({
        success: true,
        message: "Backend is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/executive", executiveRoutes);
app.use("/api/admin/customers", adminCustomerRouter);
app.use("/api/executive/customers", executiveCustomerRouter);
app.use("/api/executive", executiveAssignmentRouter);

module.exports = app;
