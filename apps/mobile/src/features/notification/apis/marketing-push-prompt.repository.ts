import type { SyncStorage } from '@src/core/ports/sync-storage';
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
  /** 노출 1회를 기록한다(시각 갱신 + count 증가) */
  record(promptedAt: Instant): void;
}

export function createMarketingPushPromptRepository(
  storage: SyncStorage,
): MarketingPushPromptRepository {
  const get = (): MarketingPushPromptState => {
    const saved = parseStoredJson(
      storage.get(MARKETING_PUSH_PROMPT_KEY),
      marketingPushPromptStateSchema,
    );
    return saved ?? { ...EMPTY_STATE };
  };

  return {
    get,
    record: (promptedAt) => {
      const next: MarketingPushPromptState = {
        lastPromptedAt: promptedAt,
        count: get().count + 1,
      };
      try {
        storage.set(MARKETING_PUSH_PROMPT_KEY, JSON.stringify(next));
      } catch {
        // 저장하지 못하면 안내가 한 번 더 보일 뿐이다.
      }
    },
  };
}
