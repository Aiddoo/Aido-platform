import type { ObservableSyncStorage } from '@src/core/ports/sync-storage';

const PUSH_PROMPT_KEY_PREFIX = 'aido_push_permission_prompt_dismissed_v1';

export interface PushPromptRepository {
  getDismissedAt(userId: string): Date | null;
  dismiss(userId: string, dismissedAt: Date): void;
  /** 이 계정의 닫기 기록이 바뀌면 알린다 */
  subscribe(userId: string, listener: () => void): () => void;
}

/** 알림 권한 안내를 닫은 시각을 계정마다 남긴다 */
export function createPushPromptRepository(storage: ObservableSyncStorage): PushPromptRepository {
  const toKey = (userId: string) => `${PUSH_PROMPT_KEY_PREFIX}:${userId}`;

  return {
    getDismissedAt: (userId) => {
      const saved = storage.get(toKey(userId));
      if (saved == null) {
        return null;
      }
      const dismissedAt = new Date(saved);
      return Number.isNaN(dismissedAt.getTime()) ? null : dismissedAt;
    },
    dismiss: (userId, dismissedAt) => storage.set(toKey(userId), dismissedAt.toISOString()),
    subscribe: (userId, listener) => storage.subscribe(toKey(userId), listener),
  };
}
