import { EventEmitter } from 'node:events';
import { dexClient, dexAccount } from './keeta.js';
import { inbox } from './inbox.js';

// App-level events you can subscribe to (for logging/metrics)
export const bus = new EventEmitter();

// Try event-based first, else fall back to polling history.
let stopPolling = false;
let cursor: string | undefined;

export function startListener() {
  // --- Preferred: SDK change stream
  if (typeof (dexClient as any).on === 'function') {
    (dexClient as any).on('change', async (evt: any) => {
      // evt should contain new blocks/ops hitting dexAccount
      await handlePossibleDeposits(evt);
    });
    bus.emit('info', 'Silverback listener: using event stream');
  } else {
    // --- Fallback: poll history periodically
    bus.emit('info', 'Silverback listener: using polling fallback');
    pollLoop().catch(err => bus.emit('error', err));
  }
}

export function stopListener() {
  stopPolling = true;
  if (typeof (dexClient as any).off === 'function') {
    (dexClient as any).off('change');
  }
}

async function pollLoop() {
  const INTERVAL = 1500;
  while (!stopPolling) {
    try {
      // History API shape can vary; assume client.history({ sinceCursor }) returns { items, cursor }
      // Replace with the actual Keeta SDK call you use in your codebase.
      // @ts-ignore
      const { items, cursor: next } = await (dexClient as any).history({ account: dexAccount.publicKeyString, since: cursor });
      if (items?.length) {
        await handlePossibleDeposits({ items });
        cursor = next || cursor;
      }
    } catch (e) {
      bus.emit('error', e);
    }
    await new Promise(r => setTimeout(r, INTERVAL));
  }
}

// Inspect new ops for user → DEX deposits that carry `external` tags matching an inbox intent.
async function handlePossibleDeposits(evt: any) {
  const ops = extractOps(evt);
  for (const op of ops) {
    // We only care about deposits *to* the DEX that include an external tag
    if (op?.type !== 'SEND') continue;
    if (op?.to !== dexAccount.publicKeyString) continue;
    const ext = op?.external as string | undefined;
    if (!ext) continue;

    const intent = inbox.get(ext);
    if (!intent) continue;

    // Validate the deposit matches the expected leg for that intent
    if (intent.kind === 'SWAP') {
      if (op.token === intent.tokenIn && BigInt(op.amount) === intent.amountIn && op.from === intent.user) {
        inbox.markFilled(ext, `deposit ${intent.amountIn} ${intent.tokenIn} received`);
        bus.emit('deposit.filled', intent);
      }
    } else if (intent.kind === 'LPADD') {
      // LPADD expects *two* deposits (KTA + TOKEN_X). You can track partial fills using notes or split intents.
      // For simplicity we’ll mark FILLED on the first leg and let the settle route verify both amounts again.
      if ((op.token === intent.tokenX || op.token === 'KTA') && op.from === intent.user) {
        inbox.markFilled(ext, `partial deposit ${op.amount} ${op.token} received`);
        bus.emit('deposit.filled', intent);
      }
    } else if (intent.kind === 'LPREM') {
      if (op.token === intent.lpToken && op.from === intent.user && BigInt(op.amount) === intent.lpAmount) {
        inbox.markFilled(ext, `LP deposit ${op.amount} received`);
        bus.emit('deposit.filled', intent);
      }
    }
  }
}

function extractOps(evt: any): any[] {
  // Normalize different shapes: evt.items[*].operations[] or evt.operations[]
  if (!evt) return [];
  if (Array.isArray(evt.items)) {
    return evt.items.flatMap((it: any) => it.operations || []);
  }
  if (Array.isArray(evt.operations)) return evt.operations;
  return [];
}
