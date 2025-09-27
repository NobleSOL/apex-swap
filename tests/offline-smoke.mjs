import assert from "node:assert/strict";

process.env.KEETA_USE_OFFLINE_FIXTURE = "1";

const { handler: addLiquidityHandler } = await import("../functions/addLiquidity.js");
const { handler: removeLiquidityHandler } = await import("../functions/removeLiquidity.js");

function buildEvent(payload) {
  return {
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify(payload),
  };
}

function parseBody(response) {
  assert.ok(response, "Response is required");
  assert.equal(response.statusCode, 200, `Expected 200 response, received ${response.statusCode}`);
  assert.ok(response.body, "Response body is missing");
  return JSON.parse(response.body);
}

const addPayload = {
  tokenA: "RIDE",
  tokenB: "USDC",
  amountA: "100",
  amountB: "50",
  seed: "test-seed",
};

const addResult = parseBody(await addLiquidityHandler(buildEvent(addPayload)));
assert.ok(addResult.pool?.address, "Add liquidity response should include pool information");
assert.ok(addResult.minted?.raw, "Add liquidity response should include minted amount");
assert.notStrictEqual(addResult.minted.raw, "0", "Minted amount should be greater than zero");

const removePayload = {
  tokenA: "RIDE",
  tokenB: "USDC",
  lpAmount: "10",
  seed: "test-seed",
};

const removeResult = parseBody(await removeLiquidityHandler(buildEvent(removePayload)));
assert.ok(removeResult.pool?.address, "Remove liquidity response should include pool information");
assert.ok(removeResult.withdrawals?.tokenA?.amountRaw, "Remove liquidity response should include token A withdrawal");

console.log("Offline smoke test passed");
