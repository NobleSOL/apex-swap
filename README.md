# Silverback Keeta Testnet Configuration

This workspace is wired for exercising the Silverback DEX against the Keeta test network with the KTA native asset and the Riding Liquid (RIDE) token.

## Default token wiring

- **KTA** – Keeta base-chain token (native).
- **RIDE** – Riding Liquid testnet token at `keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo`.

The client bootstraps the Pools API with the RIDE token override and remembers any pool overrides that you apply locally. Netlify functions also honour the same default so you can quote RIDE swaps as soon as a pool contract is supplied.

## Supplying pool contracts

Use the **Pool configuration** card on the Pools page to enter the pool account and LP token account that back the KTA/RIDE pair. The UI persists your entries in the browser so page reloads keep the configuration. When you submit the form it pushes the addresses to the Netlify functions, which use them for quoting and for add/remove liquidity transactions.

You can also set the addresses through environment variables when deploying the functions:

```bash
export KEETA_NETWORK=testnet        # alias resolves to the "test" network ID
export KEETA_POOL_ACCOUNT=<pool account>
export KEETA_LP_TOKEN_ACCOUNT=<lp token account>
export KEETA_TOKEN_RIDE=keeta_anchh4m5ukgvnx5jcwe56k3ltgo4x4kppicdjgcaftx4525gdvknf73fotmdo
# Optional: execute transactions automatically instead of returning prepared builders
export KEETA_EXECUTE_TRANSACTIONS=1
# Required when serving the UI from a custom origin (localhost, Netlify preview, etc.)
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:8888"
```

If you prefer static configuration, drop the addresses into `netlify.toml` or your hosting provider's secrets manager. Runtime overrides provided from the UI or via environment variables take precedence over the baked-in defaults.

## Wallet prerequisites

The DEX still requires a Keeta testnet wallet seed before it will submit swaps or liquidity instructions. Connect a seed in the Wallet panel on the left-hand rail; balances will appear once the client syncs. The serverless handlers also enforce this requirement and will reject requests that omit the signer seed.

## CORS configuration

The wrapped Netlify functions only respond to origins listed in `CORS_ALLOWED_ORIGINS` (plus the default builder origin). Add your development or deployment hostnames to the variable so the UI can load pool data and submit transactions. Separate multiple origins with commas and be sure to include the scheme, for example `http://localhost:3000`.

## Testing swaps and liquidity

1. Configure the pool and LP token addresses in the Pools page.
2. Use the **Apply token addresses** button if you need to override token contracts.
3. Toggle `KEETA_EXECUTE_TRANSACTIONS` to broadcast swaps and liquidity transactions automatically once you're satisfied with the quotes; otherwise the helpers return prepared builder instructions for manual inspection.

With those steps complete you can add liquidity to the KTA/RIDE pool and exercise swaps from the Swap tab.

## Post-merge verification checklist

When upstream merges land, re-run the quick regression below to confirm the DEX wiring still honours the Keeta testnet defaults:

1. `npm run build --prefix client` – ensures the React bundle still compiles cleanly against the bundled Keeta client.
2. Open the Pools screen and confirm the configuration card still displays the persisted pool, LP token, and token override addresses you last supplied.
3. Perform a dry-run add-liquidity quote with the KTA/RIDE pair to verify the serverless helpers resolve the correct contracts (no `requiresConfiguration` flags in the response).

The most recent upstream merge was validated against this checklist, so the KTA/RIDE defaults and pool override persistence remain intact.
