import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { Instant } from '@src/shared/date/instant';

import type { PushPermissionPrompt } from '../domains/push-permission.model';
import { pushPermissionPromptAtStorageSchema } from '../schemas/push-permission-prompt-storage.schema';

// 피드 안내를 닫은 시각은 출시된 앱이 쓰던 키를 그대로 읽는다
const NOTICE_DISMISSED_KEY_PREFIX = 'aido_push_permission_prompt_dismissed_v1';
const DEFERRED_KEY_PREFIX = 'aido_push_permission_prompt_deferred_v1';

export interface PushPermissionPromptRepository {
  /** 저장값이 그대로면 같은 객체를 돌려준다(`useSyncExternalStore`의 스냅샷) */
  find(userId: string): PushPermissionPrompt;
  /** 가입 직후 알림 화면에서 [나중에]를 눌렀다 */
  defer(userId: string, deferredAt: Instant): void;
  dismissNotice(userId: string, dismissedAt: Instant): void;
  subscribe(userId: string, listener: () => void): () => void;
  clear(userId: string): void;
}

function createNoticeDismissedKey(userId: string): string {
  return `${NOTICE_DISMISSED_KEY_PREFIX}:${userId}`;
}

function createDeferredKey(userId: string): string {
  return `${DEFERRED_KEY_PREFIX}:${userId}`;
}

export function createPushPermissionPromptRepository(
  storage: ObservableSyncStorage,
): PushPermissionPromptRepository {
  const snapshots = new Map<
    string,
    {
      rawDeferredAt: string | undefined;
      rawNoticeDismissedAt: string | undefined;
      prompt: PushPermissionPrompt;
    }
  >();

  const write = (key: string, at: Instant) => {
    try {
      storage.set(key, at);
    } catch {
      // 저장하지 못하면 다음에 한 번 더 물을 뿐이다.
    }
  };

  return {
    find: (userId) => {
      const rawDeferredAt = storage.get(createDeferredKey(userId));
      const rawNoticeDismissedAt = storage.get(createNoticeDismissedKey(userId));
      const cached = snapshots.get(userId);
      if (
        cached != null &&
        cached.rawDeferredAt === rawDeferredAt &&
        cached.rawNoticeDismissedAt === rawNoticeDismissedAt
      ) {
        return cached.prompt;
      }
      const prompt: PushPermissionPrompt = {
        deferredAt: pushPermissionPromptAtStorageSchema.parse(rawDeferredAt ?? null),
        noticeDismissedAt: pushPermissionPromptAtStorageSchema.parse(rawNoticeDismissedAt ?? null),
      };
      snapshots.set(userId, { rawDeferredAt, rawNoticeDismissedAt, prompt });
      return prompt;
    },
    defer: (userId, deferredAt) => write(createDeferredKey(userId), deferredAt),
    dismissNotice: (userId, dismissedAt) => write(createNoticeDismissedKey(userId), dismissedAt),
    subscribe: (userId, listener) => {
      const unsubscribeDeferred = storage.subscribe(createDeferredKey(userId), listener);
      const unsubscribeNotice = storage.subscribe(createNoticeDismissedKey(userId), listener);
      return () => {
        unsubscribeDeferred();
        unsubscribeNotice();
      };
    },
    clear: (userId) => {
      storage.remove(createDeferredKey(userId));
      storage.remove(createNoticeDismissedKey(userId));
      snapshots.delete(userId);
    },
  };
}
