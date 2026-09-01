/**
 * Shared store for the per-user `blocked` state that `account-state.ts` reads on
 * every authenticated request. Kept in its own module so the admin block/unblock
 * action (api::platform.platform.setBlock) can evict an entry the instant it
 * changes the row — D-013 requires a block to bite on the *next* request, and
 * the TTL alone would leave a stale "not blocked" entry for up to
 * ACCOUNT_STATE_TTL_MS.
 *
 * In-process only. A horizontally-scaled deployment moves this to Redis (same
 * note as the middleware itself).
 */
export type CachedAccountState = {
  blocked: boolean;
  blockedReason: string | null;
  expiresAt: number;
};

export const TTL_MS = Number(process.env.ACCOUNT_STATE_TTL_MS) || 20_000;

const store = new Map<number, CachedAccountState>();

export const accountStateCache = {
  get(userId: number): CachedAccountState | undefined {
    return store.get(userId);
  },
  set(userId: number, state: CachedAccountState): void {
    store.set(userId, state);
  },
  /** Drop one user's cached state — call after any write to their `blocked` flag. */
  bust(userId: number): void {
    store.delete(userId);
  },
  sweep(): void {
    const now = Date.now();
    for (const [id, state] of store) {
      if (state.expiresAt <= now) store.delete(id);
    }
  },
};
