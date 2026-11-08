import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { Instant } from '@src/shared/date/instant';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import {
  type MarketingPushPromptState,
  marketingPushPromptStateSchema,
} from '../schemas/marketing-push-prompt.schema';

// 출시된 앱이 쓰던 키와 JSON 모양을 그대로 읽는다
const MARKETING_PUSH_PROMPT_KEY = 'aido_marketing_push_prompt';

const EMPTY_STATE: MarketingPushPromptState = { lastPromptedAt: null, count: 0 };

export interface MarketingPushPromptRepository {
  get(): MarketingPushPromptState;
  /** 닫은 시각을 남기고 닫은 횟수를 하나 늘린다. 저장 필드 이름 `lastPromptedAt`은 출시된 앱 그대로다 */
  dismiss(dismissedAt: Instant): void;
  subscribe(listener: () => void): () => void;
}

export function createMarketingPushPromptRepository(
  storage: ObservableSyncStorage,
): MarketingPushPromptRepository {
  let cachedRaw: string | undefined;
  let cachedState: MarketingPushPromptState = EMPTY_STATE;

  const get = (): MarketingPushPromptState => {
    const raw = storage.get(MARKETING_PUSH_PROMPT_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedState = parseStoredJson(raw, marketingPushPromptStateSchema) ?? EMPTY_STATE;
    }
    return cachedState;
  };

  return {
    get,
    dismiss: (dismissedAt) => {
      const next: MarketingPushPromptState = {
        lastPromptedAt: dismissedAt,
        count: get().count + 1,
      };
      try {
        storage.set(MARKETING_PUSH_PROMPT_KEY, JSON.stringify(next));
      } catch {
        // 저장하지 못하면 안내가 한 번 더 보일 뿐이다.
      }
    },
    subscribe: (listener) => storage.subscribe(MARKETING_PUSH_PROMPT_KEY, listener),
  };
}
