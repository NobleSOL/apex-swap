// functions/removeLiquidity.js
import { withCors } from "./utils/cors.js";

/**
 * Remove liquidity from a pool
 * Input: { tokenA, tokenB, lpAmount, wallet }
 */
const handlerCore = async (event) => {
  try {
    const { tokenA, tokenB, lpAmount, wallet } = JSON.parse(event.body || "{}");

    if (!tokenA || !tokenB || !lpAmount || !wallet) {
      return { statusCode: 400, body: JSON.stringify({ error: "tokenA, tokenB, lpAmount, and wallet are required" }) };
    }

    let lp;
    try {
      lp = BigInt(lpAmount);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "lpAmount must be a valid integer string" }) };
    }

    if (lp <= 0n) {
      return { statusCode: 400, body: JSON.stringify({ error: "lpAmount must be greater than 0" }) };
    }

    // Demo: split LP equally into both tokens
    const amountA = lp / 2n;
    const amountB = lp - amountA;

    const tx = { id: `demo-${Date.now()}`, hash: `0x${Math.random().toString(16).slice(2).padEnd(8, "0")}` };

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, amountA: amountA.toString(), amountB: amountB.toString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

export const handler = withCors(handlerCore);
