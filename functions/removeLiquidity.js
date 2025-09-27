import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";
import {
  EXECUTE_TRANSACTIONS,
  calculateWithdrawal,
  createClient,
  formatAmount,
  loadPoolContext,
  toRawAmount,
} from "./utils/keeta.js";

function parseBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

async function executeRemoveLiquidity(client, context, params) {
  const poolAccount = KeetaNet.lib.Account.toAccount(context.pool.address);
  const tokenAAccount = KeetaNet.lib.Account.toAccount(params.tokenA.address);
  const tokenBAccount = KeetaNet.lib.Account.toAccount(params.tokenB.address);
  const lpTokenAccount = KeetaNet.lib.Account.toAccount(context.lpToken.address);

  const builder = client.initBuilder();
  builder.send(poolAccount, params.lpAmountRaw, lpTokenAccount);
  if (params.amountARaw > 0n) {
    builder.receive(poolAccount, params.amountARaw, tokenAAccount, true);
  }
  if (params.amountBRaw > 0n) {
    builder.receive(poolAccount, params.amountBRaw, tokenBAccount, true);
  }

  const blocks = await client.computeBuilderBlocks(builder);
  const published = await client.publishBuilder(builder);
  return { blocks, published };
}

async function handler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    const payload = parseBody(event.body);
    const {
      tokenA,
      tokenB,
      lpAmount,
      seed,
      accountIndex = 0,
      tokenAddresses: rawTokenAddresses = {},
      tokenAAddress,
      tokenBAddress,
      poolAccount,
      lpTokenAccount,
    } = payload;

    if (!tokenA || !tokenB) {
      throw new Error("Token symbols are required");
    }
    if (!lpAmount) {
      throw new Error("LP token amount is required");
    }
    if (!seed) {
      throw new Error("A signer seed is required to withdraw liquidity");
    }

    const normalizedOverrides = { ...rawTokenAddresses };
    if (tokenAAddress) {
      normalizedOverrides[tokenA] = tokenAAddress.trim();
    }
    if (tokenBAddress) {
      normalizedOverrides[tokenB] = tokenBAddress.trim();
    }

    const poolOverride =
      typeof poolAccount === "string" && poolAccount.trim() ? poolAccount.trim() : undefined;
    const lpTokenOverride =
      typeof lpTokenAccount === "string" && lpTokenAccount.trim()
        ? lpTokenAccount.trim()
        : undefined;

    client = await createClient({ seed, accountIndex });
    const context = await loadPoolContext(client, {
      poolAccount: poolOverride,
      lpTokenAccount: lpTokenOverride,
      tokenAddresses: normalizedOverrides,
    });

    const findBySymbol = (symbol) =>
      context.tokens.find((item) => item.symbol === symbol);
    const findByAddress = (address) =>
      context.tokens.find((item) => item.address === address);

    const tokenDetailsA =
      findBySymbol(tokenA) ||
      (normalizedOverrides[tokenA] && findByAddress(normalizedOverrides[tokenA]));
    const tokenDetailsB =
      findBySymbol(tokenB) ||
      (normalizedOverrides[tokenB] && findByAddress(normalizedOverrides[tokenB]));

    if (!tokenDetailsA || !tokenDetailsB) {
      throw new Error("Selected pool does not support the provided token pair");
    }

    const lpAmountRaw = toRawAmount(lpAmount, context.lpToken.decimals);
    if (lpAmountRaw <= 0n) {
      throw new Error("LP amount must be greater than zero");
    }

    const reserveA = BigInt(tokenDetailsA.reserveRaw);
    const reserveB = BigInt(tokenDetailsB.reserveRaw);
    const totalSupply = BigInt(context.lpToken.supplyRaw || "0");

    if (totalSupply <= 0n) {
      throw new Error("LP token supply is zero. Nothing to withdraw.");
    }

    const { amountA, amountB, share } = calculateWithdrawal(
      lpAmountRaw,
      reserveA,
      reserveB,
      totalSupply
    );

    if (amountA <= 0n && amountB <= 0n) {
      throw new Error("Withdrawal amounts are zero. Increase the LP amount or check pool reserves.");
    }

    let execution = {};
    if (EXECUTE_TRANSACTIONS) {
      try {
        execution = await executeRemoveLiquidity(client, context, {
          lpAmountRaw,
          amountARaw: amountA,
          amountBRaw: amountB,
          tokenA: tokenDetailsA,
          tokenB: tokenDetailsB,
        });
      } catch (execError) {
        execution = { error: execError.message };
      }
    }

    const response = {
      pool: context.pool,
      lpToken: context.lpToken,
      burn: {
        raw: lpAmountRaw.toString(),
        formatted: formatAmount(lpAmountRaw, context.lpToken.decimals),
        share: Number.isFinite(share) ? Number((share * 100).toFixed(6)) : 0,
      },
      withdrawals: {
        tokenA: {
          symbol: tokenDetailsA.symbol,
          address: tokenDetailsA.address,
          amountRaw: amountA.toString(),
          amountFormatted: formatAmount(amountA, tokenDetailsA.decimals),
        },
        tokenB: {
          symbol: tokenDetailsB.symbol,
          address: tokenDetailsB.address,
          amountRaw: amountB.toString(),
          amountFormatted: formatAmount(amountB, tokenDetailsB.decimals),
        },
      },
      execution: {
        attempted: EXECUTE_TRANSACTIONS,
        ...execution,
      },
      instructions: {
        burn: {
          token: context.lpToken.address,
          amountRaw: lpAmountRaw.toString(),
        },
        payouts: [
          ...(amountA > 0n
            ? [
                {
                  from: context.pool.address,
                  token: tokenDetailsA.address,
                  amountRaw: amountA.toString(),
                },
              ]
            : []),
          ...(amountB > 0n
            ? [
                {
                  from: context.pool.address,
                  token: tokenDetailsB.address,
                  amountRaw: amountB.toString(),
                },
              ]
            : []),
        ],
      },
      message: EXECUTE_TRANSACTIONS
        ? "Liquidity withdrawal prepared. Transaction broadcast attempted."
        : "Liquidity withdrawal prepared. Set KEETA_EXECUTE_TRANSACTIONS=1 to broadcast automatically.",
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("removeLiquidity error", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Remove liquidity failed" }),
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

export const handler = withCors(handler);
