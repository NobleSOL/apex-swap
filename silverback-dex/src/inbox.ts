export type IntentType = 'SWAP' | 'LPADD' | 'LPREM';

export interface BaseIntent {
  id: string;                 // e.g., SWAP-<uuid>
  user: string;               // user's account id
  createdAt: number;
  deadlineMs?: number;        // expire after N ms
  status: 'PENDING' | 'FILLED' | 'SETTLED' | 'EXPIRED' | 'FAILED';
  notes?: string;
}

export interface SwapIntent extends BaseIntent {
  kind: 'SWAP';
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;           // expected deposit amount
  minAmountOut: bigint;       // slippage guard (computed at quote time)
}

export interface LpAddIntent extends BaseIntent {
  kind: 'LPADD';
  kta: bigint;
  tokenX: string;
  amountX: bigint;
  lpToken: string;            // pool's LP id
  mintAmount: bigint;         // precomputed from quote
}

export interface LpRemIntent extends BaseIntent {
  kind: 'LPREM';
  lpToken: string;
  lpAmount: bigint;
  expectKTA: bigint;
  expectXToken: string;
  expectXAmount: bigint;
}

export type Intent = SwapIntent | LpAddIntent | LpRemIntent;

class Inbox {
  private map = new Map<string, Intent>();

  upsert(intent: Intent) { this.map.set(intent.id, intent); }
  get(id: string) { return this.map.get(id); }

  markFilled(id: string, notes?: string) {
    const it = this.map.get(id); if (!it) return;
    if (it.status === 'PENDING') it.status = 'FILLED';
    if (notes) it.notes = notes;
  }
  markSettled(id: string, notes?: string) {
    const it = this.map.get(id); if (!it) return;
    it.status = 'SETTLED'; if (notes) it.notes = notes;
  }
  markFailed(id: string, notes?: string) {
    const it = this.map.get(id); if (!it) return;
    it.status = 'FAILED'; if (notes) it.notes = notes;
  }
  pruneExpired(now = Date.now()) {
    for (const [id, it] of this.map.entries()) {
      if (it.deadlineMs && now - it.createdAt > it.deadlineMs && it.status === 'PENDING') {
        it.status = 'EXPIRED';
      }
    }
  }
  all() { return Array.from(this.map.values()); }
}

export const inbox = new Inbox();
