// functions/removeLiquidity.js
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./utils/cors.js";

/**
 * Remove liquidity from a pool
 * Input: { tokenA, tokenB, lpAmount, wallet }
 */
const removeLiquidityHandler = async (event) => {
  try {
    const { tokenA, tokenB, lpAmount, wallet } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");
    const builder = client.initBuilder();

    const amountA = BigInt(lpAmount) / 2n;
    const amountB = BigInt(lpAmount) / 2n;

    builder.send(wallet, amountA, tokenA);
    builder.send(wallet, amountB, tokenB);

    await client.computeBuilderBlocks(builder);
    const tx = await client.publishBuilder(builder);

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, amountA: amountA.toString(), amountB: amountB.toString() }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

export const handler = withCors(removeLiquidityHandler);
