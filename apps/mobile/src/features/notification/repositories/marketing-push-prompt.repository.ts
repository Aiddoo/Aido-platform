import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { type Instant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import type { MarketingPushPromptState } from '../domains/marketing-push-prompt.model';
import { marketingPushPromptStorageSchema } from '../schemas/marketing-push-prompt-storage.schema';

const KEY_PREFIX = 'aido_notification_marketing_push_prompt_v1';

const EMPTY_STATE: MarketingPushPromptState = { dismissedAt: null };

export interface MarketingPushPromptRepository {
  /** 저장값이 그대로면 같은 객체를 돌려준다(`useSyncExternalStore`의 스냅샷) */
  find(userId: string): MarketingPushPromptState;
  dismiss(userId: string, dismissedAt: Instant): void;
  subscribe(userId: string, listener: () => void): () => void;
  clear(userId: string): void;
}

function createKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

export function createMarketingPushPromptRepository(
  storage: ObservableSyncStorage,
): MarketingPushPromptRepository {
  const snapshots = new Map<string, { raw: string | undefined; state: MarketingPushPromptState }>();

  const save = (userId: string, state: MarketingPushPromptState) => {
    try {
      storage.set(createKey(userId), JSON.stringify(state));
    } catch {
      // 저장하지 못하면 제안이 한 번 더 보일 뿐이다.
    }
  };

  return {
    find: (userId) => {
      const raw = storage.get(createKey(userId));
      const cached = snapshots.get(userId);
      if (cached != null && cached.raw === raw) {
        return cached.state;
      }
      const state = parseStoredJson(raw, marketingPushPromptStorageSchema) ?? EMPTY_STATE;
      snapshots.set(userId, { raw, state });
      return state;
    },
    dismiss: (userId, dismissedAt) => save(userId, { dismissedAt }),
    subscribe: (userId, listener) => storage.subscribe(createKey(userId), listener),
    clear: (userId) => {
      storage.remove(createKey(userId));
      snapshots.delete(userId);
    },
  };
}
