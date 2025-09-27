import 'dotenv/config';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import { z } from 'zod';

const envSchema = z.object({
  NETWORK: z.enum(['test', 'main', 'staging', 'dev']).default('test'),
  DEX_SEED: z.string().min(1, 'DEX_SEED missing'),
});

const parsedEnv = envSchema.parse({
  NETWORK: process.env.NETWORK ?? 'test',
  DEX_SEED: process.env.DEX_SEED,
});

export const NETWORK = parsedEnv.NETWORK;
const dexSeed = parsedEnv.DEX_SEED;

export const dexAccount = KeetaNet.lib.Account.fromSeed(dexSeed, 0);
export const dexClient = KeetaNet.UserClient.fromNetwork(NETWORK, dexAccount);

export async function getBaseTokenId(): Promise<string> {
  return String(dexClient.baseToken);
}

export async function balanceOf(token: string) {
  return dexClient.balance(token);
}

export async function send(
  to: string,
  amount: bigint,
  token: string,
  external?: string,
) {
  return dexClient.send(to, amount, token, external);
}
