import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import type { CoachmarkInput } from '../domains/coachmark.model';

export interface CoachmarkRepository {
  hasSeen(input: CoachmarkInput): boolean;
  markSeen(input: CoachmarkInput): void;
  removeRetiredKeys(): void;
  clear(accountId: string): void;
}

const REORDER_KEY_PREFIX = 'aido_reorder_coachmark_v1';
const FRIEND_STRIP_KEY_PREFIX = 'aido_friend_strip_hint_dismissed_v1';
const KEY_PREFIX = 'aido_coachmark_v1';
/** 더는 쓰지 않아 지우는 안내. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 */
const RETIRED_COACHMARK_KINDS: readonly string[] = ['ai-consent-notice'];

/** 재정렬·친구 찾기 안내는 1.14.x까지 쓰던 키를 그대로 읽어 이미 본 사람에게 다시 보이지 않는다 */
export function createCoachmarkKey({ accountId, kind }: CoachmarkInput): string {
  return match(kind)
    .with('todo-reorder', () => `${REORDER_KEY_PREFIX}:${accountId}:todo`)
    .with('category-reorder', () => `${REORDER_KEY_PREFIX}:${accountId}:category`)
    .with('friend-strip', () => `${FRIEND_STRIP_KEY_PREFIX}:${accountId}`)
    .with(
      'comment-double-tap',
      'voice-quick-start',
      'voice-note-start',
      'voice-note-mark',
      'voice-key-point',
      'repeat-horizon',
      'ai-consent-renewal',
      () => `${KEY_PREFIX}:${accountId}:${kind}`,
    )
    .exhaustive();
}

export function createCoachmarkRepository(
  storage: SyncStorage & Pick<EnumerableSyncStorage, 'keys'>,
  now: () => Instant,
): CoachmarkRepository {
  return {
    hasSeen: (input) => {
      try {
        return storage.get(createCoachmarkKey(input)) != null;
      } catch {
        return true;
      }
    },
    markSeen: (input) => {
      try {
        storage.set(createCoachmarkKey(input), now());
      } catch {
        // 저장하지 못하면 다음에 한 번 더 보일 뿐이다.
      }
    },
    removeRetiredKeys: () => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${KEY_PREFIX}:`) &&
            RETIRED_COACHMARK_KINDS.includes(key.slice(key.lastIndexOf(':') + 1)),
        )
        .forEach((key) => storage.remove(key));
    },
    clear: (accountId) => {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${KEY_PREFIX}:${accountId}:`) ||
            key.startsWith(`${REORDER_KEY_PREFIX}:${accountId}:`) ||
            key === `${FRIEND_STRIP_KEY_PREFIX}:${accountId}`,
        )
        .forEach((key) => storage.remove(key));
    },
  };
}
