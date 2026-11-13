
const {
    getExecutiveDashboardStats
} = require("./executive.service");

// Returns Executive Dashboard statistics.
const getExecutiveDashboardStatsController = async (req, res) => {

    try {

        const stats = await getExecutiveDashboardStats();

        return res.status(200).json({
            success: true,
            message: "Executive dashboard statistics fetched successfully",
            data: stats
        });

    } catch (error) {

        console.error("Executive Dashboard Stats Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch Executive dashboard statistics"
        });
    }
};

module.exports = {
    getExecutiveDashboardStatsController
};
