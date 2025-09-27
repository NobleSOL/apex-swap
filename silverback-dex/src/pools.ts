import * as KeetaNet from '@keetanetwork/keetanet-client';
import { z } from 'zod';
import { dexAccount, dexClient, getBaseTokenId } from './keeta.js';

const quoteSchema = z.string().min(1, 'quoteTokenId is required');

const lpName = (base: string, quote: string) => `Silverback LP ${base}-${quote}`;

export async function createPool(quoteTokenIdRaw: string) {
  const quoteTokenId = quoteSchema.parse(quoteTokenIdRaw);
  const baseTokenId = await getBaseTokenId();

  const lpIdentifier = `SILVERBACK_LP_${baseTokenId}_${quoteTokenId}_${Date.now()}`;

  const builder = dexClient.initBuilder();
  builder
    .block()
    .addAccount(dexAccount)
    .addOperation(
      new KeetaNet.Referenced.BlockOperationCREATE_IDENTIFIER({
        identifier: lpIdentifier,
      }),
    )
    .seal();

  await dexClient.publishBuilder(builder);

  await dexClient.setInfo({
    name: lpName(baseTokenId, quoteTokenId),
    description: `Liquidity provider token for ${baseTokenId}/${quoteTokenId} on Silverback`,
    metadata: JSON.stringify({ silverback: true, base: baseTokenId, quote: quoteTokenId }),
  });

  await dexClient.updatePermissions(
    dexAccount,
    { base: { TOKEN_ADMIN_SUPPLY: true } },
    KeetaNet.lib.Account.fromPublicKeyString(lpIdentifier),
  );

  return { baseTokenId, quoteTokenId, lpIdentifier };
}
