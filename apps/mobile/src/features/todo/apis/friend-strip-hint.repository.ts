import type { ObservableSyncStorage } from '@src/core/ports/sync-storage';

const FRIEND_STRIP_HINT_KEY_PREFIX = 'aido_friend_strip_hint_dismissed_v1';

export interface FriendStripHintRepository {
  isDismissed(userId: string): boolean;
  dismiss(userId: string): void;
  /** 이 계정의 닫기 기록이 바뀌면 알린다 */
  subscribe(userId: string, listener: () => void): () => void;
}

/** 친구 줄 빈 상태 안내를 계정마다 한 번 닫으면 다시 보이지 않게 닫은 시각을 남긴다 */
export function createFriendStripHintRepository(
  storage: ObservableSyncStorage,
): FriendStripHintRepository {
  const toKey = (userId: string) => `${FRIEND_STRIP_HINT_KEY_PREFIX}:${userId}`;

  return {
    isDismissed: (userId) => storage.get(toKey(userId)) != null,
    dismiss: (userId) => storage.set(toKey(userId), new Date().toISOString()),
    subscribe: (userId, listener) => storage.subscribe(toKey(userId), listener),
  };
}
