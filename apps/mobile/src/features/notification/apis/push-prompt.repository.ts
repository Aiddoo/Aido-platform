import type { SyncStorage } from '@src/core/ports/sync-storage';

const PUSH_PROMPT_KEY_PREFIX = 'aido_push_permission_prompt_dismissed_v1';

export interface PushPromptRepository {
  dismiss(userId: string, dismissedAt: Date): void;
}

export function pushPromptStorageKey(userId: string): string {
  return `${PUSH_PROMPT_KEY_PREFIX}:${userId}`;
}

/** 저장값이 날짜가 아니면 닫은 적 없는 것으로 본다 */
export function parsePushPromptDismissedAt(saved: string | undefined): Date | null {
  if (saved == null) {
    return null;
  }
  const dismissedAt = new Date(saved);

  return Number.isNaN(dismissedAt.getTime()) ? null : dismissedAt;
}

/** 알림 권한 안내를 닫은 시각을 계정마다 남긴다 */
export function createPushPromptRepository(storage: SyncStorage): PushPromptRepository {
  return {
    dismiss: (userId, dismissedAt) =>
      storage.set(pushPromptStorageKey(userId), dismissedAt.toISOString()),
  };
}
