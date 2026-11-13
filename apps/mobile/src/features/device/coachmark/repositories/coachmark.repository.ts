import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';

import type { CoachmarkInput } from '../domains/coachmark.model';
import { COACHMARK_KEY_PREFIX, toCoachmarkKey } from '../schemas/coachmark-storage.schema';

// 1.15.1까지 재정렬(`:{account}:todo|category`)·친구 줄(`:{account}`) 안내가 쓰던 키. 옮기는 코드와 함께 1.16.0에서 지운다(compatibility.md)
const LEGACY_REORDER_KEY_PREFIX = 'aido_reorder_coachmark_v1';
const LEGACY_FRIEND_STRIP_KEY_PREFIX = 'aido_friend_strip_hint_dismissed_v1';
/** 더는 쓰지 않아 지우는 안내. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 */
const RETIRED_COACHMARK_KINDS: readonly string[] = ['ai-consent-notice'];

export interface CoachmarkRepository {
  /** 옛 키의 원문을 `aido_coachmark_v1:{account}:{kind}`로 옮기고 옛 키를 지운다. 여러 번 불러도 같다 */
  migrateLegacyKeys(): void;
  removeRetiredKeys(): void;
  clear(accountId: string): void;
}

function toLegacyCoachmark(key: string): CoachmarkInput | null {
  if (key.startsWith(`${LEGACY_FRIEND_STRIP_KEY_PREFIX}:`)) {
    const accountId = key.slice(LEGACY_FRIEND_STRIP_KEY_PREFIX.length + 1);
    return accountId.length > 0 ? { accountId, kind: 'friend-strip' } : null;
  }
  if (!key.startsWith(`${LEGACY_REORDER_KEY_PREFIX}:`)) {
    return null;
  }
  const scope = key.slice(LEGACY_REORDER_KEY_PREFIX.length + 1);
  const separatorIndex = scope.lastIndexOf(':');
  if (separatorIndex <= 0) {
    return null;
  }
  const reorderKinds: Readonly<Record<string, CoachmarkInput['kind']>> = {
    todo: 'todo-reorder',
    category: 'category-reorder',
  };
  const kind = reorderKinds[scope.slice(separatorIndex + 1)];
  return kind == null ? null : { accountId: scope.slice(0, separatorIndex), kind };
}

export function createCoachmarkRepository(
  storage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
): CoachmarkRepository {
  return {
    migrateLegacyKeys: () => {
      storage.keys().forEach((legacyKey) => {
        const coachmark = toLegacyCoachmark(legacyKey);
        if (coachmark == null) {
          return;
        }
        const raw = storage.get(legacyKey);
        const key = toCoachmarkKey(coachmark);
        // 새 키가 이미 있으면 먼저 끝낸 기록을 둔다. 쓰기가 실패하면 던져 옛 키를 남기고 다음 시작 때 다시 옮긴다
        if (raw != null && storage.get(key) == null) {
          storage.set(key, raw);
        }
        storage.remove(legacyKey);
      });
    },
    removeRetiredKeys: () => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${COACHMARK_KEY_PREFIX}:`) &&
            RETIRED_COACHMARK_KINDS.includes(key.slice(key.lastIndexOf(':') + 1)),
        )
        .forEach((key) => storage.remove(key));
    },
    clear: (accountId) => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${COACHMARK_KEY_PREFIX}:${accountId}:`) ||
            toLegacyCoachmark(key)?.accountId === accountId,
        )
        .forEach((key) => storage.remove(key));
    },
  };
}
