import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import { type Instant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import type { MarketingPushPromptState } from '../domains/marketing-push-prompt.model';
import {
  legacyMarketingPushPromptStorageSchema,
  marketingPushPromptStorageSchema,
} from '../schemas/marketing-push-prompt-storage.schema';

// 1.14.x까지 계정 구분 없이 쓰던 키. 지우지 않으면 다음 계정이 앞사람이 닫은 기록을 이어받는다
// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const LEGACY_DEVICE_KEY = 'aido_marketing_push_prompt';
// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const KEY_PREFIX = 'aido_notification_marketing_push_prompt_v1';

const EMPTY_STATE: MarketingPushPromptState = { dismissedAt: null };

export interface MarketingPushPromptRepository {
  /** 저장값이 그대로면 같은 객체를 돌려준다(`useSyncExternalStore`의 스냅샷) */
  find(userId: string): MarketingPushPromptState;
  dismiss(userId: string, dismissedAt: Instant): void;
  subscribe(userId: string, listener: () => void): () => void;
  /** 기기에 남은 1.14.x 기록을 이 계정으로 한 번 옮기고 지운다. 이미 계정 기록이 있으면 지우기만 한다 */
  claimDeviceRecord(userId: string): void;
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
    claimDeviceRecord: (userId) => {
      const legacy = parseStoredJson(
        storage.get(LEGACY_DEVICE_KEY),
        legacyMarketingPushPromptStorageSchema,
      );
      if (legacy?.lastPromptedAt != null && storage.get(createKey(userId)) == null) {
        save(userId, { dismissedAt: legacy.lastPromptedAt });
      }
      storage.remove(LEGACY_DEVICE_KEY);
    },
    clear: (userId) => {
      storage.remove(createKey(userId));
      snapshots.delete(userId);
    },
  };
}
