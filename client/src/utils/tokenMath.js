/* global BigInt */

export function toRawAmount(amount, decimals) {
  if (amount === undefined || amount === null) return 0n;
  const normalized = String(amount).trim();
  if (!normalized) return 0n;
  const negative = normalized.startsWith("-");
  const digits = negative ? normalized.slice(1) : normalized;
  if (!/^[0-9]*\.?[0-9]*$/.test(digits)) {
    throw new Error(`Invalid numeric amount: ${amount}`);
  }
  const [whole, fraction = ""] = digits.split(".");
  const truncatedFraction = fraction.slice(0, decimals);
  const paddedFraction = truncatedFraction.padEnd(decimals, "0");
  const combined = `${whole || "0"}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  const raw = combined ? BigInt(combined) : 0n;
  return negative ? -raw : raw;
}

export function formatAmount(raw, decimals) {
  const value = BigInt(raw);
  const abs = value < 0n ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = (abs % base).toString().padStart(decimals, "0");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const sign = value < 0n ? "-" : "";
  return trimmedFraction ? `${sign}${whole}.${trimmedFraction}` : `${sign}${whole}`;
}

export function calculateSwapQuote(amountIn, reserveIn, reserveOut, feeBps) {
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
  const newPrice = newReserveIn > 0n && newReserveOut > 0n
    ? Number(newReserveOut) / Number(newReserveIn)
    : spotPrice;
  const priceImpact = spotPrice === 0 ? 0 : Math.max(0, (spotPrice - newPrice) / spotPrice);

  return {
    amountOut,
    feePaid,
    priceImpact,
  };
}

export function calculateLiquidityQuote(amountA, amountB, reserveA, reserveB, totalSupply) {
  if (amountA <= 0n || amountB <= 0n) {
    return { minted: 0n, share: 0 };
  }
  if (reserveA === 0n || reserveB === 0n || totalSupply === 0n) {
    const minted = sqrtBigInt(amountA * amountB);
    return { minted, share: 1 };
  }
  const liquidityA = (amountA * totalSupply) / reserveA;
  const liquidityB = (amountB * totalSupply) / reserveB;
  const minted = liquidityA < liquidityB ? liquidityA : liquidityB;
  const share = Number(minted) / Number(totalSupply);
  return { minted, share: Number.isFinite(share) ? share : 0 };
}

export function calculateWithdrawalQuote(lpAmount, reserveA, reserveB, totalSupply) {
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
