import { UserClient, lib as KeetaNetLib } from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";

function parseRequest(event) {
  if (!event?.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

async function swap(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    const payload = parseRequest(event);
    const {
      seed,
      poolId,
      tokenIn,
      tokenOut,
      amountIn,
      accountIndex = 0,
    } = payload;

    if (!seed || !poolId || !tokenIn || !tokenOut || !amountIn) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields",
        }),
      };
    }

    if (typeof KeetaNetLib?.Account?.fromSeed !== "function") {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "SDK version doesn't support Account.fromSeed()",
        }),
      };
    }

    const account = KeetaNetLib.Account.fromSeed(seed, accountIndex);
    const network = process.env.KEETA_NETWORK || "test";
    client = UserClient.fromNetwork(network);

    const tx = await client.buildBlock({
      operation: "CREATE_SWAP",
      params: {
        pool: poolId,
        tokenIn,
        tokenOut,
        amountIn,
      },
      account,
    });

    const result = await client.publishBlock(tx);

    return {
      statusCode: 200,
      body: JSON.stringify({ txHash: result.hash }),
    };
  } catch (error) {
    console.error("Swap error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Swap failed" }),
    };
  } finally {
    if (client && typeof client.destroy === "function") {
      try {
        await client.destroy();
      } catch (destroyError) {
        console.warn("Failed to destroy Keeta client", destroyError);
      }
    }
  }
}

export const handler = withCors(swap);
