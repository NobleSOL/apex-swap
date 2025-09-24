import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";

// Constant product AMM formula
function getOutputAmount(inputAmount, reserveIn, reserveOut) {
  const inputWithFee = inputAmount * 997n; // 0.3% fee
  const numerator = inputWithFee * reserveOut;
  const denominator = reserveIn * 1000n + inputWithFee;
  return numerator / denominator;
}

const baseHandler = async (event) => {
  try {
    const { from, to, amount, wallet } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");

    // Placeholder reserves (TODO: fetch real balances from chain)
    const reserveIn = 1000000n;
    const reserveOut = 500000n;

    const outputAmount = getOutputAmount(BigInt(amount), reserveIn, reserveOut);

    const builder = client.initBuilder();

    // User sends `amount` of token A to pool
    builder.send("POOL_ADDRESS_" + from, BigInt(amount), from);

    // Pool sends `outputAmount` of token B to user
    builder.send(wallet, outputAmount, to);

    await client.computeBuilderBlocks(builder);
    const tx = await client.publishBuilder(builder);

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, outputAmount: outputAmount.toString() }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

export const handler = withCors(baseHandler);
