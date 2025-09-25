import { withCors } from "./cors.js";
import { createClient, loadPoolContext } from "./utils/keeta.js";

async function handler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    client = await createClient();
    const context = await loadPoolContext(client);
    return {
      statusCode: 200,
      body: JSON.stringify({
        ...context,
        message: "Pool state fetched successfully",
      }),
    };
  } catch (error) {
    console.error("getpool error", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to load pool" }),
    };
  } finally {
    if (client && typeof client.destroy === "function") {
      try {
        await client.destroy();
      } catch (destroyErr) {
        console.warn("Failed to destroy Keeta client", destroyErr);
      }
    }
  }
}

export const handler = withCors(handler);
