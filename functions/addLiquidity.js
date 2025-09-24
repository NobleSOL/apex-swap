// functions/addLiquidity.js
import { withCors } from "./utils/cors.js";

/**
 * Add liquidity to a pool
 * Input: { tokenA, tokenB, amountA, amountB, wallet }
 */
const handlerCore = async (event) => {
  try {
    const { tokenA, tokenB, amountA, amountB, wallet } = JSON.parse(event.body || "{}");

    if (!tokenA || !tokenB || !amountA || !amountB || !wallet) {
      return { statusCode: 400, body: JSON.stringify({ error: "tokenA, tokenB, amountA, amountB, and wallet are required" }) };
    }

    let amtA, amtB;
    try {
      amtA = BigInt(amountA);
      amtB = BigInt(amountB);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "amountA/amountB must be valid integer strings" }) };
    }

    if (amtA <= 0n || amtB <= 0n) {
      return { statusCode: 400, body: JSON.stringify({ error: "amounts must be greater than 0" }) };
    }

    const tx = { id: `demo-${Date.now()}`, hash: `0x${Math.random().toString(16).slice(2).padEnd(8, "0")}` };

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, message: "Liquidity added" }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

export const handler = withCors(handlerCore);
