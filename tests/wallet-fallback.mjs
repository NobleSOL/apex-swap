import assert from "node:assert/strict";

process.env.KEETA_USE_OFFLINE_FIXTURE = "";

const keetaModule = await import("@keetanetwork/keetanet-client");
const originalFromNetwork = keetaModule.UserClient.fromNetwork;

keetaModule.UserClient.fromNetwork = () => {
  throw new Error("Simulated network outage");
};

try {
  const { handler: walletHandler } = await import("../functions/wallet.js");
  const seed = "a".repeat(64);
  const event = {
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({ seed, accountIndex: 0 }),
  };

  const response = await walletHandler(event);
  assert.equal(response.statusCode, 200, "Wallet handler should fall back when network fails");
  assert.ok(response.body, "Wallet response should include a body");

  const payload = JSON.parse(response.body);
  assert.equal(payload.seed, seed, "Fallback response should echo the request seed");
  assert.ok(payload.address, "Fallback response should include a derived address");
  assert.ok(payload.baseToken?.symbol, "Fallback response should include base token metadata");
  assert.ok(
    typeof payload.message === "string" && payload.message.toLowerCase().includes("without contacting"),
    "Fallback response should mention offline handling"
  );
} finally {
  keetaModule.UserClient.fromNetwork = originalFromNetwork;
}

console.log("Wallet fallback smoke test passed");
