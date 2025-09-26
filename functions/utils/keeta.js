/* global BigInt */
import * as KeetaNet from "@keetanetwork/keetanet-client";

const DEFAULT_NETWORK = process.env.KEETA_NETWORK || "test";
const DEFAULT_POOL_ACCOUNT =
  process.env.KEETA_POOL_ACCOUNT ||
  "keeta_atki2vx75726w2ez75dbl662t7rhlcbhhvgsps4srwymwzvldrydhzkrl4fng";
const DEFAULT_LP_TOKEN_ACCOUNT =
  process.env.KEETA_LP_TOKEN_ACCOUNT ||
  "keeta_amdjie4di55jfnbh7vhsiophjo27dwv5s4qd5qf7p3q7rppgwbwowwjw6zsfs";

const EXECUTE_TRANSACTIONS = /^1|true$/i.test(
  process.env.KEETA_EXECUTE_TRANSACTIONS || ""
);

function getEnvTokenAddress(symbol) {
  if (!symbol) return null;
  const envKey = `KEETA_TOKEN_${symbol.toUpperCase()}`;
  return process.env[envKey] || null;
}

function decodeMetadata(metadata) {
  if (!metadata) return {};
  try {
    const buffer = Buffer.from(metadata, "base64");
    if (!buffer.length) return {};
    return JSON.parse(buffer.toString("utf8"));
  } catch (err) {
    return {};
  }
}

function formatAmount(raw, decimals) {
  const bigRaw = BigInt(raw);
  const absValue = bigRaw < 0n ? -bigRaw : bigRaw;
  const base = 10n ** BigInt(decimals);
  const whole = absValue / base;
  const fraction = (absValue % base).toString().padStart(decimals, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const sign = bigRaw < 0n ? "-" : "";
  return trimmedFraction ? `${sign}${whole}.${trimmedFraction}` : `${sign}${whole}`;
}

function toRawAmount(amount, decimals) {
  if (amount === undefined || amount === null) return 0n;
  const normalized = String(amount).trim();
  if (!normalized) return 0n;
  const negative = normalized.startsWith("-");
  const value = negative ? normalized.slice(1) : normalized;
  if (!/^[0-9]*\.?[0-9]*$/.test(value)) {
    throw new Error(`Invalid numeric amount: ${amount}`);
  }
  const [whole, fraction = ""] = value.split(".");
  const truncatedFraction = fraction.slice(0, decimals);
  const paddedFraction = truncatedFraction.padEnd(decimals, "0");
  const combined = `${whole || "0"}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  const raw = combined ? BigInt(combined) : 0n;
  return negative ? -raw : raw;
}

function sqrtBigInt(value) {
  if (value < 0n) {
    throw new Error("Cannot take square root of negative value");
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value;
  let x1 = (value >> 1n) + 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (value / x1 + x1) >> 1n;
  }
  return x0;
}

function calculateSwapQuote(amountIn, reserveIn, reserveOut, feeBps) {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
    return {
      amountOut: 0n,
      feePaid: 0n,
      priceImpact: 0,
    };
  }
  const feeDenominator = 10000n;
  const feeNumerator = feeDenominator - BigInt(feeBps ?? 0);
  const amountInWithFee = amountIn * feeNumerator;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * feeDenominator + amountInWithFee;
  const amountOut = denominator === 0n ? 0n : numerator / denominator;
  const feePaid = amountIn - (amountInWithFee / feeDenominator);

  const spotPrice = Number(reserveOut) / Number(reserveIn);
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const newPrice =
    newReserveIn > 0n && newReserveOut > 0n
      ? Number(newReserveOut) / Number(newReserveIn)
      : spotPrice;
  const priceImpact =
    spotPrice === 0 ? 0 : Math.max(0, (spotPrice - newPrice) / spotPrice);

  return {
    amountOut,
    feePaid,
    priceImpact,
  };
}

function calculateLiquidityMint(amountA, amountB, reserveA, reserveB, totalSupply) {
  if (amountA <= 0n || amountB <= 0n) {
    return { minted: 0n, share: 0 };
  }
  if (reserveA === 0n || reserveB === 0n || totalSupply === 0n) {
    const geometricMean = sqrtBigInt(amountA * amountB);
    return { minted: geometricMean, share: 1 };
  }
  const liquidityA = (amountA * totalSupply) / reserveA;
  const liquidityB = (amountB * totalSupply) / reserveB;
  const minted = liquidityA < liquidityB ? liquidityA : liquidityB;
  const share = Number(minted) / Number(totalSupply);
  return { minted, share: Number.isFinite(share) ? share : 0 };
}

function calculateWithdrawal(lpAmount, reserveA, reserveB, totalSupply) {
  if (lpAmount <= 0n || totalSupply <= 0n) {
    return { amountA: 0n, amountB: 0n, share: 0 };
  }
  const amountA = (lpAmount * reserveA) / totalSupply;
  const amountB = (lpAmount * reserveB) / totalSupply;
  const share = Number(lpAmount) / Number(totalSupply);
  return {
    amountA,
    amountB,
    share: Number.isFinite(share) ? share : 0,
  };
}

async function createClient(options = {}) {
  const { seed, accountIndex = 0 } = options;
  let signer = null;
  if (seed) {
    signer = KeetaNet.lib.Account.fromSeed(seed, accountIndex);
  }
  return KeetaNet.UserClient.fromNetwork(DEFAULT_NETWORK, signer);
}

async function resolveTokenAccount(
  client,
  symbol,
  fallback,
  overrideAddress
) {
  if (!symbol) return fallback || null;
  if (overrideAddress) {
    try {
      return KeetaNet.lib.Account.toAccount(overrideAddress);
    } catch (error) {
      throw new Error(`Invalid override address provided for ${symbol}`);
    }
  }
  if (symbol.toUpperCase() === "KTA") {
    return client.baseToken;
  }
  const envAddress = getEnvTokenAddress(symbol);
  if (envAddress) {
    return KeetaNet.lib.Account.toAccount(envAddress);
  }
  return fallback || null;
}

async function loadTokenDetails(client, account) {
  const accountInfo = await client.client.getAccountInfo(account);
  const metadata = decodeMetadata(accountInfo.info.metadata);
  const decimals = metadata.decimalPlaces ?? metadata.decimals ?? 0;
  const symbol =
    metadata.symbol || accountInfo.info.name || account.publicKeyString.get();
  return {
    address: account.publicKeyString.get(),
    account,
    info: accountInfo.info,
    decimals,
    metadata,
    symbol,
  };
}

function normalizeTokenOverrides(overrides = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (!key || !value) continue;
    normalized[key] = value;
    if (typeof key === "string") {
      normalized[key.toUpperCase()] = value;
    }
  }
  return normalized;
}

async function loadPoolContext(client, overrides = {}) {
  const poolAccountAddress = overrides.poolAccount || DEFAULT_POOL_ACCOUNT;
  const pool = KeetaNet.lib.Account.toAccount(poolAccountAddress);
  const poolInfo = await client.client.getAccountInfo(pool);
  const poolMetadata = decodeMetadata(poolInfo.info.metadata);
  const tokenSymbols = [poolMetadata.tokenA, poolMetadata.tokenB].filter(Boolean);

  const lpTokenAccount = overrides.lpTokenAccount
    ? KeetaNet.lib.Account.toAccount(overrides.lpTokenAccount)
    : KeetaNet.lib.Account.toAccount(DEFAULT_LP_TOKEN_ACCOUNT);
  const lpTokenInfo = await loadTokenDetails(client, lpTokenAccount);
  const lpSupply = await client.client.getTokenSupply(lpTokenAccount);

  const tokenAddressOverrides = normalizeTokenOverrides(
    overrides.tokenAddresses || {}
  );

  const baseTokenDetails = await loadTokenDetails(client, client.baseToken);
  const baseToken = {
    symbol:
      baseTokenDetails.metadata.symbol ||
      baseTokenDetails.info.name ||
      "KTA",
    address: baseTokenDetails.address,
    decimals: baseTokenDetails.decimals,
    info: baseTokenDetails.info,
    metadata: baseTokenDetails.metadata,
  };

  const tokenDetails = [];
  for (const symbol of tokenSymbols) {
    const fallbackAccount = null;
    const overrideAddress =
      tokenAddressOverrides[symbol] ||
      tokenAddressOverrides[symbol?.toUpperCase?.()];
    const tokenAccount = await resolveTokenAccount(
      client,
      symbol,
      fallbackAccount,
      overrideAddress
    );
    if (!tokenAccount) {
      throw new Error(
        `Token address for symbol ${symbol} is not configured. Set KEETA_TOKEN_${symbol.toUpperCase()}`
      );
    }
    const details = await loadTokenDetails(client, tokenAccount);
    details.symbol = symbol;
    tokenDetails.push(details);
  }

  const balances = await client.client.getAllBalances(pool);
  const reserveMap = new Map();
  for (const { token, balance } of balances) {
    reserveMap.set(token.publicKeyString.get(), balance);
  }

  const formattedTokens = tokenDetails.map((token) => {
    const raw = reserveMap.get(token.address) || 0n;
    return {
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      info: token.info,
      metadata: token.metadata,
      reserveRaw: raw.toString(),
      reserveFormatted: formatAmount(raw, token.decimals),
    };
  });

  return {
    network: DEFAULT_NETWORK,
    executeTransactions: EXECUTE_TRANSACTIONS,
    pool: {
      address: poolAccountAddress,
      name: poolInfo.info.name,
      description: poolInfo.info.description,
      metadata: poolMetadata,
      feeBps: poolMetadata.feeBps ?? 30,
    },
    tokens: formattedTokens,
    reserves: formattedTokens.reduce((acc, token) => {
      acc[token.symbol] = token;
      return acc;
    }, {}),
    lpToken: {
      symbol: lpTokenInfo.metadata.symbol || lpTokenInfo.info.name,
      address: lpTokenInfo.address,
      decimals: lpTokenInfo.decimals,
      info: lpTokenInfo.info,
      metadata: lpTokenInfo.metadata,
      supplyRaw: lpSupply.toString(),
      supplyFormatted: formatAmount(lpSupply, lpTokenInfo.decimals),
    },
    baseToken,
    timestamp: new Date().toISOString(),
  };
}

export {
  DEFAULT_NETWORK,
  DEFAULT_POOL_ACCOUNT,
  DEFAULT_LP_TOKEN_ACCOUNT,
  EXECUTE_TRANSACTIONS,
  calculateLiquidityMint,
  calculateSwapQuote,
  calculateWithdrawal,
  createClient,
  decodeMetadata,
  formatAmount,
  loadPoolContext,
  loadTokenDetails,
  toRawAmount,
};
