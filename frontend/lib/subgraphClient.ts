const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
// Extract URL using regex to handle malformed env vars (newlines, literal \n, etc.)
const match = rawUrl.match(/^(https?:\/\/[^\s\\]+)/);
const BACKEND_URL = match ? match[1] : "http://localhost:4000";

export async function fetchAnalytics() {
  try {
    console.log("Fetching analytics from:", `${BACKEND_URL}/analytics`);
    const res = await fetch(`${BACKEND_URL}/analytics`);
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const json = await res.json();
    console.log("Analytics data:", json);
    return json;
  } catch (e) {
    console.error("fetchAnalytics failed:", e);
    throw e;
  }
}
