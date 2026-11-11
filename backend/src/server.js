
import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
