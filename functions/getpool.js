// functions/getPool.js
import * as KeetaNet from "@keetanetwork/keetanet-client";
ai_master_d7ba31322481
import { withCors } from "./utils/cors.js";
import { withCors } from "./cors.js";
master

/**
 * Get pool reserves for two tokens
 * Input: { tokenA, tokenB }
 */
ai_master_d7ba31322481
const getPoolHandler = async (event) => {
const baseHandler = async (event) => {
master
  try {
    const { tokenA, tokenB } = JSON.parse(event.body || "{}");

    const client = KeetaNet.UserClient.fromNetwork("test");

    const reserveA = 1000000n;
    const reserveB = 500000n;

    return {
      statusCode: 200,
      body: JSON.stringify({
        tokenA,
        tokenB,
        reserveA: reserveA.toString(),
        reserveB: reserveB.toString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

ai_master_d7ba31322481
export const handler = withCors(getPoolHandler);
export const handler = withCors(baseHandler);
master
