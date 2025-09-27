import * as KeetaNet from '@keetanetwork/keetanet-client';
import { z } from 'zod';
import { dexAccount, dexClient, getBaseTokenId } from './keeta.js';

const quoteSchema = z.string().min(1, 'quoteTokenId is required');

const lpName = (base: string, quote: string) => `Silverback LP ${base}-${quote}`;

export async function createPool(quoteTokenIdRaw: string) {
  const quoteTokenId = quoteSchema.parse(quoteTokenIdRaw);
  const baseTokenId = await getBaseTokenId();

  const lpIdentifier = `SILVERBACK_LP_${baseTokenId}_${quoteTokenId}_${Date.now()}`;

  const builder: any = dexClient.initBuilder();
  builder.block?.();
  builder.addAccount?.(dexAccount);
  builder.addOperation?.(
    new (KeetaNet as any).Referenced.BlockOperationCREATE_IDENTIFIER({
      identifier: lpIdentifier,
    }),
  );
  builder.seal?.();

  await dexClient.publishBuilder(builder);

  await dexClient.setInfo({
    name: lpName(baseTokenId, quoteTokenId),
    description: `Liquidity provider token for ${baseTokenId}/${quoteTokenId} on Silverback`,
    metadata: JSON.stringify({ silverback: true, base: baseTokenId, quote: quoteTokenId }),
  });

  await (dexClient as any).updatePermissions(
    dexAccount,
    { base: { TOKEN_ADMIN_SUPPLY: true } },
    (KeetaNet as any).lib.Account.fromPublicKeyString(lpIdentifier),
  );

  return { baseTokenId, quoteTokenId, lpIdentifier };
}
