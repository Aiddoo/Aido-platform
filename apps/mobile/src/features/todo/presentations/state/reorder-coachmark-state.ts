import type { SyncStorage } from '@src/core/ports/sync-storage';

const KEY_PREFIX = 'aido_reorder_coachmark_v1';

export type ReorderCoachmarkKind = 'todo' | 'category';

interface ClaimReorderCoachmarkInput {
  accountId: string;
  kind: ReorderCoachmarkKind;
}

const reorderCoachmarkKey = ({ accountId, kind }: ClaimReorderCoachmarkInput): string =>
  `${KEY_PREFIX}:${accountId}:${kind}`;

export function claimReorderCoachmark(
  storage: SyncStorage,
  input: ClaimReorderCoachmarkInput,
): boolean {
  try {
    const key = reorderCoachmarkKey(input);
    if (storage.getString(key) !== undefined) {
      return false;
    }
    storage.set(key, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}
