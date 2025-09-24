// functions/removeLiquidity.js
import * as KeetaNet from "@keetanetwork/keetanet-client";
ai_master_d7ba31322481
import { withCors } from "./utils/cors.js";
import { withCors } from "./cors.js";
master

/**
 * Remove liquidity from a pool
 * Input: { tokenA, tokenB, lpAmount, wallet }
 */
ai_master_d7ba31322481
const removeLiquidityHandler = async (event) => {
const baseHandler = async (event) => {
master
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

ai_master_d7ba31322481
export const handler = withCors(removeLiquidityHandler);
export const handler = withCors(baseHandler);
master
