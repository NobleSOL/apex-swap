// functions/getpool.js
import { withCors } from "./utils/cors.js";

/**
 * Get pool reserves for two tokens
 * Input: { tokenA, tokenB }
 */
const handlerCore = async (event) => {
  try {
    const { tokenA, tokenB } = JSON.parse(event.body || "{}");

    if (!tokenA || !tokenB) {
      return { statusCode: 400, body: JSON.stringify({ error: "tokenA and tokenB are required" }) };
    }

    // Demo reserves (constant product style demo numbers)
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
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

export const handler = withCors(handlerCore);
