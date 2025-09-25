import { withCors } from "./cors.js";
import { createClient, loadPoolContext } from "./utils/keeta.js";

function parseOverrides(event) {
  if (!event || !event.body) {
    return {};
  }
  try {
    const payload = JSON.parse(event.body);
    if (!payload || typeof payload !== "object") {
      return {};
    }
    const overrides = {};
    if (payload.poolAccount) {
      overrides.poolAccount = payload.poolAccount;
    }
    if (payload.lpTokenAccount) {
      overrides.lpTokenAccount = payload.lpTokenAccount;
    }
    if (payload.tokenAddresses && typeof payload.tokenAddresses === "object") {
      overrides.tokenAddresses = { ...payload.tokenAddresses };
    }
    return overrides;
  } catch (error) {
    console.warn("Failed to parse getpool overrides", error);
    return {};
  }
}

async function getPoolHandler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    client = await createClient();
    const overrides = parseOverrides(event);
    const context = await loadPoolContext(client, overrides);
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

export const handler = withCors(getPoolHandler);
