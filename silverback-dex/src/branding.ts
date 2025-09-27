import { dexAccount, dexClient } from './keeta.js';

export async function brandSilverback() {
  const info = {
    name: 'Silverback DEX',
    description: 'The native AMM DEX for trading tokens against KTA',
    metadata: JSON.stringify({ project: 'Silverback', website: 'https://your.site' }),
  } as const;

  const result = await dexClient.setInfo(info);
  console.log('Branded account', dexAccount.publicKeyString, result);
  return result;
}
