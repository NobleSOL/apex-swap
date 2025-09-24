// functions/addLiquidity.js
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./utils/cors.js";

/**
 * Add liquidity to a pool
 * Input: { tokenA, tokenB, amountA, amountB, wallet }
 */
const addLiquidityHandler = async (event) => {
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

export const handler = withCors(addLiquidityHandler);
