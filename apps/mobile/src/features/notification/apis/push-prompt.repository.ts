import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { type Instant, instantSchema } from '@src/shared/date/instant';

const PUSH_PROMPT_KEY_PREFIX = 'aido_push_permission_prompt_dismissed_v1';

export interface PushPromptRepository {
  /** 저장값이 날짜가 아니면 닫은 적 없는 것으로 본다 */
  findDismissedAt(userId: string): Instant | null;
  dismiss(userId: string, dismissedAt: Instant): void;
  subscribe(userId: string, listener: () => void): () => void;
}

function createPushPromptKey(userId: string): string {
  return `${PUSH_PROMPT_KEY_PREFIX}:${userId}`;
}

/** 알림 권한 안내를 닫은 시각을 계정마다 남긴다 */
export function createPushPromptRepository(storage: ObservableSyncStorage): PushPromptRepository {
  return {
    findDismissedAt: (userId) => {
      const parsed = instantSchema.safeParse(storage.get(createPushPromptKey(userId)));
      return parsed.success ? parsed.data : null;
    },
    dismiss: (userId, dismissedAt) => {
      try {
        storage.set(createPushPromptKey(userId), dismissedAt);
      } catch {
        // 저장하지 못하면 다음에 한 번 더 물을 뿐이다.
      }
    },
    subscribe: (userId, listener) => storage.subscribe(createPushPromptKey(userId), listener),
  };
}
