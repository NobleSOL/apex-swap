import { createHash } from "node:crypto";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";
import {
  DEFAULT_NETWORK,
  decodeMetadata,
  formatAmount,
  loadOfflinePoolContext,
} from "./utils/keeta.js";

const HEX_SEED_REGEX = /^[0-9a-f]{64}$/i;

function parseBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

function normalizeSeed(seed) {
  if (seed === undefined || seed === null) {
    return "";
  }
  return String(seed).trim();
}

function hashSeedForOffline(seed) {
  const hashed = createHash("sha256").update(seed).digest("hex");
  return hashed.padEnd(64, "0").slice(0, 64);
}

function deriveAccount(seed, accountIndex, allowOfflineFallback) {
  const normalizedSeed = normalizeSeed(seed);
  if (!normalizedSeed) {
    throw new Error("A wallet seed is required");
  }

  const usableSeed = HEX_SEED_REGEX.test(normalizedSeed)
    ? normalizedSeed
    : allowOfflineFallback
    ? hashSeedForOffline(normalizedSeed)
    : null;

  if (!usableSeed) {
    throw new Error("Provide a 64-character hexadecimal seed");
  }

  return {
    normalizedSeed,
    account: KeetaNet.lib.Account.fromSeed(usableSeed, accountIndex),
  };
}

function parseAccountIndex(index) {
  if (index === undefined || index === null || index === "") {
    return 0;
  }
  const parsed = Number(index);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Account index must be a non-negative integer");
  }
  return parsed;
}

async function loadBaseTokenDetails(client) {
  const info = await client.client.getAccountInfo(client.baseToken);
  const metadata = decodeMetadata(info.info.metadata);
  const decimals = metadata.decimalPlaces ?? metadata.decimals ?? 0;
  const symbol = metadata.symbol || info.info.name || "KTA";
  return {
    address: client.baseToken.publicKeyString.get(),
    decimals,
    symbol,
    metadata,
    info: info.info,
  };
}

async function loadIdentifier(client, account) {
  try {
    const info = await client.client.getAccountInfo(account);
    const metadata = info?.info?.metadata;
    const possibleValues = [
      metadata?.identifierAccount,
      metadata?.identifier,
      metadata?.account,
    ];
    for (const value of possibleValues) {
      if (!value) {
        continue;
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "object") {
        if (typeof value?.address === "string") {
          return value.address;
        }
        if (typeof value?.publicKeyString === "string") {
          return value.publicKeyString;
        }
      }
    }
  } catch (infoError) {
    console.warn("Failed to read identifier metadata", infoError);
  }

  try {
    const pending = await client.generateIdentifier(
      KeetaNet.lib.Account.AccountKeyAlgorithm.NETWORK,
      { account }
    );
    return pending.account.publicKeyString.get();
  } catch (error) {
    console.warn("Falling back to account address for identifier", error);
    return account.publicKeyString.get();
  }
}

async function walletHandler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    const { seed, accountIndex: rawIndex } = parseBody(event.body);
    const accountIndex = parseAccountIndex(rawIndex);
    const offlineContext = await loadOfflinePoolContext();
    const { normalizedSeed, account } = deriveAccount(
      seed,
      accountIndex,
      Boolean(offlineContext)
    );
    if (offlineContext) {
      const baseToken = offlineContext.baseToken || {};
      const network = offlineContext.network || DEFAULT_NETWORK;
      const address = account.publicKeyString.get();
      const decimalsValue = Number(baseToken.decimals);
      const decimals = Number.isFinite(decimalsValue) && decimalsValue >= 0 ? decimalsValue : 0;
      const response = {
        seed: normalizedSeed,
        accountIndex,
        address,
        identifier: address,
        network,
        baseToken: {
          symbol: baseToken.symbol || "KTA",
          address: baseToken.address || "",
          decimals,
          metadata: baseToken.metadata || {},
          balanceRaw: "0",
          balanceFormatted: "0",
        },
        message: "Wallet details fetched from offline fixture",
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

codex/update-addliquidity-and-removeliquidity-functions-gkkb6z

    const accountIndex = parseAccountIndex(rawIndex);
    const account = KeetaNet.lib.Account.fromSeed(normalizedSeed, accountIndex);
    const offlineContext = await loadOfflinePoolContext();
    if (offlineContext) {
      const baseToken = offlineContext.baseToken || {};
      const network = offlineContext.network || DEFAULT_NETWORK;
      const address = account.publicKeyString.get();
      const decimalsValue = Number(baseToken.decimals);
      const decimals = Number.isFinite(decimalsValue) && decimalsValue >= 0 ? decimalsValue : 0;
      const response = {
        seed: normalizedSeed,
        accountIndex,
        address,
        identifier: address,
        network,
        baseToken: {
          symbol: baseToken.symbol || "KTA",
          address: baseToken.address || "",
          decimals,
          metadata: baseToken.metadata || {},
          balanceRaw: "0",
          balanceFormatted: "0",
        },
        message: "Wallet details fetched from offline fixture",
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

master
    client = KeetaNet.UserClient.fromNetwork(DEFAULT_NETWORK, account);
    const identifierAddress = await loadIdentifier(client, account);

    const baseToken = await loadBaseTokenDetails(client);
    let balanceRaw;
    try {
      balanceRaw = await client.balance(client.baseToken, { account });
    } catch (balanceError) {
      console.warn("Falling back to zero balance for wallet", balanceError);
      balanceRaw = 0n;
    }

    const response = {
      seed: normalizedSeed,
      accountIndex,
      address: account.publicKeyString.get(),
      identifier: identifierAddress,
      network: DEFAULT_NETWORK,
      baseToken: {
        symbol: baseToken.symbol,
        address: baseToken.address,
        decimals: baseToken.decimals,
        metadata: baseToken.metadata,
        balanceRaw: balanceRaw.toString(),
        balanceFormatted: formatAmount(balanceRaw, baseToken.decimals),
      },
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("wallet error", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Wallet lookup failed" }),
    };
  } finally {
    if (client && typeof client.destroy === "function") {
      try {
        await client.destroy();
      } catch (destroyErr) {
        console.warn("Failed to destroy Keeta client", destroyErr);
      }
    }
  }
}

export const handler = withCors(walletHandler);
