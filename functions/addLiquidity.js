// functions/addLiquidity.js
import * as KeetaNet from "@keetanetwork/keetanet-client";
ai_master_d7ba31322481
import { withCors } from "./utils/cors.js";
import { withCors } from "./cors.js";
master

/**
 * Add liquidity to a pool
 * Input: { tokenA, tokenB, amountA, amountB, wallet }
 */
ai_master_d7ba31322481
const addLiquidityHandler = async (event) => {
const baseHandler = async (event) => {
master
  try {
    const { tokenA, tokenB, amountA, amountB, wallet } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");

    const builder = client.initBuilder();

    // Example: send both tokens into the pool account
    builder.send("POOL_ADDRESS_" + tokenA, BigInt(amountA), tokenA);
    builder.send("POOL_ADDRESS_" + tokenB, BigInt(amountB), tokenB);

    await client.computeBuilderBlocks(builder);
    const tx = await client.publishBuilder(builder);

    return {
      statusCode: 200,
      body: JSON.stringify({ tx, message: "Liquidity added" }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

ai_master_d7ba31322481
export const handler = withCors(addLiquidityHandler);

export const handler = withCors(baseHandler);
master
