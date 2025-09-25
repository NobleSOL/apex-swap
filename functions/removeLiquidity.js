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
codex/verify-amm-liquidity-pool-token-functionality-8fk14o
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

async function removeLiquidityHandler(event) {
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
    } = payload;
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

async function handler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    const payload = parseBody(event.body);
    const { tokenA, tokenB, lpAmount, seed, accountIndex = 0 } = payload;
master

    if (!tokenA || !tokenB) {
      throw new Error("Token symbols are required");
    }
    if (!lpAmount) {
      throw new Error("LP token amount is required");
    }
    if (!seed) {
      throw new Error("A signer seed is required to withdraw liquidity");
    }

codex/verify-amm-liquidity-pool-token-functionality-8fk14o
    const normalizedOverrides = { ...rawTokenAddresses };
    if (tokenAAddress) {
      normalizedOverrides[tokenA] = tokenAAddress;
    }
    if (tokenBAddress) {
      normalizedOverrides[tokenB] = tokenBAddress;
    }

    client = await createClient({ seed, accountIndex });
    const context = await loadPoolContext(client, {
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

    client = await createClient({ seed, accountIndex });
    const context = await loadPoolContext(client);

    const tokenDetailsA = context.tokens.find((item) => item.symbol === tokenA);
    const tokenDetailsB = context.tokens.find((item) => item.symbol === tokenB);

    if (!tokenDetailsA || !tokenDetailsB) {
      throw new Error("Selected pool does not support the provided token pair");
    }

    const lpAmountRaw = toRawAmount(lpAmount, context.lpToken.decimals);
    if (lpAmountRaw <= 0n) {
      throw new Error("LP amount must be greater than zero");
    }

master
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

    const execution = EXECUTE_TRANSACTIONS
      ? {
          attempted: false,
          error:
            "Automatic liquidity withdrawal is not yet implemented. Submit the instructions manually.",
        }
      : { attempted: false };

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
      execution,
      instructions: {
        burn: {
          token: context.lpToken.address,
          amountRaw: lpAmountRaw.toString(),
        },
        payouts: [
          {
            from: context.pool.address,
            token: tokenDetailsA.address,
            amountRaw: amountA.toString(),
          },
          {
            from: context.pool.address,
            token: tokenDetailsB.address,
            amountRaw: amountB.toString(),
          },
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

codex/verify-amm-liquidity-pool-token-functionality-8fk14o
export const handler = withCors(removeLiquidityHandler);
export const handler = withCors(handler);
master
