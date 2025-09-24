// functions/getPool.js
import * as KeetaNet from "@keetanetwork/keetanet-client";

/**
 * Get pool reserves for two tokens
 * Input: { tokenA, tokenB }
 */
export async function handler(event) {
  try {
    const { tokenA, tokenB } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");

    // TODO: Query balances from Keeta accounts
    // For now, return placeholder reserves
    const reserveA = 1000000n;
    const reserveB = 500000n;

    return {
      statusCode: 200,
      body: JSON.stringify({
        tokenA,
        tokenB,
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
