export function minOutFromSlippage(
  quotedOut: bigint,
  maxSlippageBps: number // e.g., 50 = 0.50%
): bigint {
  const b = BigInt(maxSlippageBps);
  return (quotedOut * (BigInt(10_000) - b)) / BigInt(10_000);
}

export function assertSlippage(amountOut: bigint, minAmountOut: bigint) {
  if (amountOut < minAmountOut) {
    const msg = `Slippage exceeded: got ${amountOut}, need >= ${minAmountOut}`;
    const err: any = new Error(msg);
    err.code = 'SLIPPAGE';
    throw err;
  }
}
