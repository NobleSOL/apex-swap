// functions/swap.js
import * as KeetaNet from "@keetanetwork/keetanet-client";

// Example AMM formula (constant product)
function getOutputAmount(inputAmount, reserveIn, reserveOut) {
  const inputWithFee = inputAmount * 997n; // 0.3% fee
  const numerator = inputWithFee * reserveOut;
  const denominator = reserveIn * 1000n + inputWithFee;
  return numerator / denominator;
}

export async function handler(event) {
  try {
    const { from, to, amount, wallet } = JSON.parse(event.body || "{}");

    // Initialize client (TODO: replace with proper signer/auth)
    const client = KeetaNet.UserClient.fromNetwork("test");

    // Example reserves (TODO: fetch real reserves from chain state)
    const reserveIn = 1000000n;
    const reserveOut = 500000n;

    const outputAmount = getOutputAmount(BigInt(amount), reserveIn, reserveOut);

    // Build swap transaction
    const builder = client.initBuilder();

    // Send `amount` of token A from user to pool
    builder.send("POOL_ADDRESS_" + from, BigInt(amount), from);

    // Send `outputAmount` of token B from pool to user
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
}

