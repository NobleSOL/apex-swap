import * as KeetaNet from "@keetanetwork/keetanet-client";
import { withCors } from "./cors.js";
import {
  EXECUTE_TRANSACTIONS,
  calculateSwapQuote,
  createClient,
  formatAmount,
  loadPoolContext,
  toRawAmount,
} from "./utils/keeta.js";

function parseRequestBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("Invalid JSON body");
  }
}

function sanitizeSlippage(slippageBps) {
  if (slippageBps === undefined || slippageBps === null) {
    return 50; // default 0.50%
  }
  const value = Number(slippageBps);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(5000, Math.floor(value));
}

async function executeSwap(client, poolContext, params) {
  const poolAccount = KeetaNet.lib.Account.toAccount(poolContext.pool.address);
  const tokenInAccount = KeetaNet.lib.Account.toAccount(params.tokenIn.address);
  const tokenOutAccount = KeetaNet.lib.Account.toAccount(params.tokenOut.address);

  const builder = client.initBuilder();
  builder.send(poolAccount, params.amountInRaw, tokenInAccount);
  builder.receive(poolAccount, params.amountOutRaw, tokenOutAccount, true);

  const blocks = await client.computeBuilderBlocks(builder);
  const published = await client.publishBuilder(builder);
  return { blocks, published };
}

async function swapHandler(event) {
  if (event.httpMethod && event.httpMethod.toUpperCase() === "OPTIONS") {
    return { statusCode: 204, body: "" };
  }

  let client;
  try {
    const payload = parseRequestBody(event.body);
    const {
      from,
      to,
      amount,
      seed,
      accountIndex = 0,
      slippageBps,
      tokenAddresses: rawTokenAddresses = {},
      fromAddress,
      toAddress,
    } = payload;

    if (!from || !to) {
      throw new Error("Both 'from' and 'to' symbols are required");
    }
    if (!amount) {
      throw new Error("Swap amount is required");
    }
    if (!seed) {
      throw new Error("A signer seed is required to prepare the swap");
    }

    const normalizedOverrides = { ...rawTokenAddresses };
    if (fromAddress) {
      normalizedOverrides[from] = fromAddress;
    }
    if (toAddress) {
      normalizedOverrides[to] = toAddress;
    }

    client = await createClient({ seed, accountIndex });
    const context = await loadPoolContext(client, {
      tokenAddresses: normalizedOverrides,
    });

    const findBySymbol = (symbol) =>
      context.tokens.find((token) => token.symbol === symbol);
    const findByAddress = (address) =>
      context.tokens.find((token) => token.address === address);

    const tokenIn =
      findBySymbol(from) ||
      (normalizedOverrides[from] && findByAddress(normalizedOverrides[from]));
    const tokenOut =
      findBySymbol(to) ||
      (normalizedOverrides[to] && findByAddress(normalizedOverrides[to]));

    if (!tokenIn || !tokenOut) {
      throw new Error("Selected token pair is not supported by the pool");
    }

    const amountInRaw = toRawAmount(amount, tokenIn.decimals);
    if (amountInRaw <= 0n) {
      throw new Error("Swap amount must be greater than zero");
    }

    const reserveIn = BigInt(tokenIn.reserveRaw);
    const reserveOut = BigInt(tokenOut.reserveRaw);
    const { amountOut, feePaid, priceImpact } = calculateSwapQuote(
      amountInRaw,
      reserveIn,
      reserveOut,
      context.pool.feeBps
    );

    if (amountOut <= 0n) {
      throw new Error(
        "Swap output is zero — increase the input amount or check pool liquidity"
      );
    }

    const slippage = sanitizeSlippage(slippageBps);
    const minimumOut = amountOut - (amountOut * BigInt(slippage)) / 10000n;

    let execution = {};
    if (EXECUTE_TRANSACTIONS) {
      try {
        execution = await executeSwap(client, context, {
          amountInRaw,
          amountOutRaw: amountOut,
          tokenIn,
          tokenOut,
        });
      } catch (execError) {
        execution = { error: execError.message };
      }
    }

    const impactPercent = Number.isFinite(priceImpact)
      ? Number((priceImpact * 100).toFixed(4))
      : 0;

    const response = {
      pool: context.pool,
      tokens: {
        from: {
          symbol: tokenIn.symbol,
          address: tokenIn.address,
          amount: amount,
          amountRaw: amountInRaw.toString(),
          feePaidRaw: feePaid.toString(),
          feePaidFormatted: formatAmount(feePaid, tokenIn.decimals),
        },
        to: {
          symbol: tokenOut.symbol,
          address: tokenOut.address,
          expectedRaw: amountOut.toString(),
          expectedFormatted: formatAmount(amountOut, tokenOut.decimals),
          minimumRaw: minimumOut.toString(),
          minimumFormatted: formatAmount(minimumOut, tokenOut.decimals),
        },
      },
      priceImpact: impactPercent,
      feeBps: context.pool.feeBps,
      slippageBps: slippage,
      execution: {
        attempted: EXECUTE_TRANSACTIONS,
        ...execution,
      },
      instructions: {
        send: {
          to: context.pool.address,
          token: tokenIn.address,
          amountRaw: amountInRaw.toString(),
        },
        receive: {
          from: context.pool.address,
          token: tokenOut.address,
          amountRaw: amountOut.toString(),
        },
      },
      message: EXECUTE_TRANSACTIONS
        ? "Swap prepared. Transaction broadcast attempted."
        : "Swap quote prepared. Set KEETA_EXECUTE_TRANSACTIONS=1 to broadcast automatically.",
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("swap error", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Swap failed" }),
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

export const handler = withCors(swapHandler);
