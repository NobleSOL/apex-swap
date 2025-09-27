export const FEE_BPS = 30;
export const BPS_DENOM = 10_000;

export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps = FEE_BPS,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const feeNumer = BigInt(BPS_DENOM - feeBps);
  const amountInWithFee = amountIn * feeNumer;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BigInt(BPS_DENOM) + amountInWithFee;
  return numerator / denominator;
}

export function sqrt(y: bigint): bigint {
  if (y <= 0n) return 0n;
  let z = y;
  let x = y / 2n + 1n;
  while (x < z) {
    z = x;
    x = (y / x + x) / 2n;
  }
  return z;
}

export function getLpToMint(
  addBase: bigint,
  addQuote: bigint,
  reserveBase: bigint,
  reserveQuote: bigint,
  totalLp: bigint,
): bigint {
  if (totalLp === 0n) return sqrt(addBase * addQuote);
  if (reserveBase === 0n || reserveQuote === 0n) return 0n;
  const byBase = (addBase * totalLp) / reserveBase;
  const byQuote = (addQuote * totalLp) / reserveQuote;
  return byBase < byQuote ? byBase : byQuote;
}

export function getProportionalOut(
  lpAmount: bigint,
  totalLp: bigint,
  reserveBase: bigint,
  reserveQuote: bigint,
) {
  if (totalLp === 0n) {
    return { base: 0n, quote: 0n };
  }
  return {
    base: (reserveBase * lpAmount) / totalLp,
    quote: (reserveQuote * lpAmount) / totalLp,
  };
}
