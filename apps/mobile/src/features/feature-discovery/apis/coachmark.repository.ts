import type { SyncStorage } from '@src/core/ports/sync-storage';
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
}

const LEGACY_REORDER_KEY_PREFIX = 'aido_reorder_coachmark_v1';
const KEY_PREFIX = 'aido_coachmark_v1';

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
  storage: SyncStorage,
  now: () => Date = () => new Date(),
): CoachmarkRepository {
  return {
    isSeen(input) {
      try {
        return storage.getString(coachmarkStorageKey(input)) != null;
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
  };
}
