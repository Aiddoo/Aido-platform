import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { match } from 'ts-pattern';

export type CoachmarkKind =
  | 'todo-reorder'
  | 'category-reorder'
  | 'comment-double-tap'
  | 'voice-quick-start'
  | 'voice-note-start'
  | 'voice-note-mark'
  | 'voice-key-point'
  | 'repeat-horizon'
  | 'ai-consent-renewal';

export interface CoachmarkInput {
  accountId: string;
  kind: CoachmarkKind;
}

export interface CoachmarkRepository {
  isSeen(input: CoachmarkInput): boolean;
  markSeen(input: CoachmarkInput): void;
  /** 은퇴한 안내의 키를 지운다 */
  removeRetiredKeys(): void;
  /** 탈퇴한 계정의 키를 지운다 */
  removeAccount(accountId: string): void;
}

const LEGACY_REORDER_KEY_PREFIX = 'aido_reorder_coachmark_v1';
const KEY_PREFIX = 'aido_coachmark_v1';
/** 더는 쓰지 않아 지우는 안내. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 */
const RETIRED_COACHMARK_KINDS: readonly string[] = ['ai-consent-notice'];

/** 재정렬 안내는 1.14.0 이하에서 쓰던 키를 그대로 읽어 이미 본 사람에게 다시 보이지 않는다 */
export function coachmarkStorageKey({ accountId, kind }: CoachmarkInput): string {
  return match(kind)
    .with('todo-reorder', () => `${LEGACY_REORDER_KEY_PREFIX}:${accountId}:todo`)
    .with('category-reorder', () => `${LEGACY_REORDER_KEY_PREFIX}:${accountId}:category`)
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
  now: () => Date = () => new Date(),
): CoachmarkRepository {
  return {
    isSeen(input) {
      try {
        return storage.get(coachmarkStorageKey(input)) != null;
      } catch {
        return true;
      }
    },
    markSeen(input) {
      try {
        storage.set(coachmarkStorageKey(input), now().toISOString());
      } catch {
        // 저장하지 못하면 다음에 한 번 더 보일 뿐이다.
      }
    },
    removeRetiredKeys() {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${KEY_PREFIX}:`) &&
            RETIRED_COACHMARK_KINDS.includes(key.slice(key.lastIndexOf(':') + 1)),
        )
        .forEach((key) => storage.remove(key));
    },
    removeAccount(accountId) {
      storage
        .keys()
        .filter(
          (key) =>
            key.startsWith(`${KEY_PREFIX}:${accountId}:`) ||
            key.startsWith(`${LEGACY_REORDER_KEY_PREFIX}:${accountId}:`),
        )
        .forEach((key) => storage.remove(key));
    },
  };
}
