
const express = require("express");

const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

const {
    getExecutiveDashboardStatsController
} = require("./executive.controller");

const router = express.Router();

// Executive Dashboard Statistics.
router.get(
    "/dashboard/stats",
    authenticate,
    authorize("EXECUTIVE"),
    getExecutiveDashboardStatsController
);

module.exports = router;
