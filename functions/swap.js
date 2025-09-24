import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./utils/cors.js";

// Constant product AMM formula
function getOutputAmount(inputAmount, reserveIn, reserveOut) {
  const inputWithFee = inputAmount * 997n;
  const numerator = inputWithFee * reserveOut;
  const denominator = reserveIn * 1000n + inputWithFee;
  return numerator / denominator;
}

const swapHandler = async (event) => {
  try {
    const { from, to, amount, wallet } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");

    const reserveIn = 1000000n;
    const reserveOut = 500000n;

    const outputAmount = getOutputAmount(BigInt(amount), reserveIn, reserveOut);

    const builder = client.initBuilder();

    builder.send("POOL_ADDRESS_" + from, BigInt(amount), from);
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

export const handler = withCors(swapHandler);
