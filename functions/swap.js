// functions/swap.js
import { withCors } from "./utils/cors.js";

// Constant product AMM formula (x*y=k) with 0.3% fee
function getOutputAmount(inputAmount, reserveIn, reserveOut) {
  const inputWithFee = inputAmount * 997n;
  const numerator = inputWithFee * reserveOut;
  const denominator = reserveIn * 1000n + inputWithFee;
  return denominator === 0n ? 0n : numerator / denominator;
}

const handlerCore = async (event) => {
  try {
    const { from, to, amount, wallet } = JSON.parse(event.body || "{}");

    if (!from || !to || !amount || !wallet) {
      return { statusCode: 400, body: JSON.stringify({ error: "from, to, amount, and wallet are required" }) };
    }

    // Demo reserves
    const reserveIn = 1000000n;
    const reserveOut = 500000n;

    let input;
    try {
      input = BigInt(amount);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "amount must be a valid integer string" }) };
    }

    if (input <= 0n) {
      return { statusCode: 400, body: JSON.stringify({ error: "amount must be greater than 0" }) };
    }

    const outputAmount = getOutputAmount(input, reserveIn, reserveOut);

    // Return a demo transaction reference
    const tx = { id: `demo-${Date.now()}`, hash: `0x${Math.random().toString(16).slice(2).padEnd(8, "0")}` };

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, outputAmount: outputAmount.toString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

export const handler = withCors(handlerCore);
