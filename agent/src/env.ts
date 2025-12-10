import 'dotenv/config';

export const env = {
    BACKEND_URL: process.env.BACKEND_URL || "http://localhost:4000",
    // Default to local graph node if running locally, or studio URL
    SUBGRAPH_URL: process.env.SUBGRAPH_URL || "http://localhost:8000/subgraphs/name/tifa",
    POLL_INTERVAL_MS: Number(process.env.POLL_INTERVAL_MS || 5000), // 5 seconds
};
