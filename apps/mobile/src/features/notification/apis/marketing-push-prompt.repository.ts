import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

import type { MarketingPushPromptState } from '../domains/marketing-push-prompt.model';

// 출시된 앱이 쓰던 키와 JSON 모양을 그대로 읽는다
const MARKETING_PUSH_PROMPT_KEY = 'aido_marketing_push_prompt';

// 날짜로 읽을 수 없는 값은 null로 바꿔 다시 보이게 한다(Invalid Date는 던지지 않고 NaN이라 정책이 조용히 틀린다)
const savedStateSchema = z.object({
  count: z.number(),
  lastPromptedAt: z
    .string()
    .nullable()
    .transform((value) =>
      value != null && !Number.isNaN(new Date(value).getTime()) ? value : null,
    ),
});

const EMPTY_STATE: MarketingPushPromptState = { lastPromptedAt: null, count: 0 };

export interface MarketingPushPromptRepository {
  get(): MarketingPushPromptState;
  /** 노출 1회를 기록한다(시각 갱신 + count 증가) */
  record(promptedAt: Date): void;
}

export function createMarketingPushPromptRepository(
  storage: SyncStorage,
): MarketingPushPromptRepository {
  const get = (): MarketingPushPromptState => {
    const saved = storage.get(MARKETING_PUSH_PROMPT_KEY);
    if (!saved) {
      return { ...EMPTY_STATE };
    }
    try {
      const parsed = savedStateSchema.safeParse(JSON.parse(saved));
      return parsed.success ? parsed.data : { ...EMPTY_STATE };
    } catch {
      return { ...EMPTY_STATE };
    }
  };

  return {
    get,
    record: (promptedAt) => {
      const next: MarketingPushPromptState = {
        lastPromptedAt: promptedAt.toISOString(),
        count: get().count + 1,
      };
      storage.set(MARKETING_PUSH_PROMPT_KEY, JSON.stringify(next));
    },
  };
}
