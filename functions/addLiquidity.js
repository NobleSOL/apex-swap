import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";
import {
  EXECUTE_TRANSACTIONS,
  calculateLiquidityMint,
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

async function executeAddLiquidity(client, context, params) {
  const poolAccount = KeetaNet.lib.Account.toAccount(context.pool.address);
  const tokenAAccount = KeetaNet.lib.Account.toAccount(params.tokenA.address);
  const tokenBAccount = KeetaNet.lib.Account.toAccount(params.tokenB.address);
  const lpTokenAccount = KeetaNet.lib.Account.toAccount(context.lpToken.address);

  const builder = client.initBuilder();
  builder.send(poolAccount, params.amountARaw, tokenAAccount);
  builder.send(poolAccount, params.amountBRaw, tokenBAccount);
  builder.receive(poolAccount, params.mintedRaw, lpTokenAccount, true);

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
      amountA,
      amountB,
      seed,
      accountIndex = 0,
      tokenAddresses: rawTokenAddresses = {},
      tokenAAddress,
      tokenBAddress,
    } = payload;

    if (!tokenA || !tokenB) {
      throw new Error("Token symbols are required");
    }
    if (!amountA || !amountB) {
      throw new Error("Both token amounts are required to add liquidity");
    }
    if (!seed) {
      throw new Error("A signer seed is required to add liquidity");
    }

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

    const amountARaw = toRawAmount(amountA, tokenDetailsA.decimals);
    const amountBRaw = toRawAmount(amountB, tokenDetailsB.decimals);

    if (amountARaw <= 0n || amountBRaw <= 0n) {
      throw new Error("Liquidity amounts must be greater than zero");
    }

    const reserveA = BigInt(tokenDetailsA.reserveRaw);
    const reserveB = BigInt(tokenDetailsB.reserveRaw);
    const totalSupply = BigInt(context.lpToken.supplyRaw || "0");

    const { minted, share } = calculateLiquidityMint(
      amountARaw,
      amountBRaw,
      reserveA,
      reserveB,
      totalSupply
    );

    if (minted <= 0n) {
      throw new Error(
        "Deposit is too small to mint LP tokens. Increase the amount and try again."
      );
    }

    const optimalBRaw = reserveA === 0n ? amountBRaw : (amountARaw * reserveB) / (reserveA || 1n);
    const optimalARaw = reserveB === 0n ? amountARaw : (amountBRaw * reserveA) / (reserveB || 1n);

    const sharePercent = Number.isFinite(share)
      ? Number((share * 100).toFixed(6))
      : 0;

    let execution = {};
    if (EXECUTE_TRANSACTIONS) {
      try {
        execution = await executeAddLiquidity(client, context, {
          amountARaw,
          amountBRaw,
          mintedRaw: minted,
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
      deposits: {
        tokenA: {
          symbol: tokenDetailsA.symbol,
          address: tokenDetailsA.address,
          amountRaw: amountARaw.toString(),
          amountFormatted: formatAmount(amountARaw, tokenDetailsA.decimals),
        },
        tokenB: {
          symbol: tokenDetailsB.symbol,
          address: tokenDetailsB.address,
          amountRaw: amountBRaw.toString(),
          amountFormatted: formatAmount(amountBRaw, tokenDetailsB.decimals),
        },
      },
      minted: {
        raw: minted.toString(),
        formatted: formatAmount(minted, context.lpToken.decimals),
        share: sharePercent,
      },
      optimalDepositRatio: {
        forTokenA: optimalARaw.toString(),
        forTokenB: optimalBRaw.toString(),
      },
      execution: {
        attempted: EXECUTE_TRANSACTIONS,
        ...execution,
      },
      instructions: {
        deposits: [
          {
            to: context.pool.address,
            token: tokenDetailsA.address,
            amountRaw: amountARaw.toString(),
          },
          {
            to: context.pool.address,
            token: tokenDetailsB.address,
            amountRaw: amountBRaw.toString(),
          },
        ],
        lpMint: {
          token: context.lpToken.address,
          amountRaw: minted.toString(),
        },
      },
      message: EXECUTE_TRANSACTIONS
        ? "Liquidity provision prepared. Transaction broadcast attempted."
        : "Liquidity provision prepared. Set KEETA_EXECUTE_TRANSACTIONS=1 to broadcast automatically.",
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("addLiquidity error", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Add liquidity failed" }),
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
