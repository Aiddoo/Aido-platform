import type { SyncStorage } from '@src/core/ports/sync-storage';

/** 마케팅 푸시 옵트인 프롬프트의 도배 방지 상태 (MMKV 저장) */
export interface MarketingPushPromptState {
  /** 마지막으로 프롬프트를 노출한 시각 (ISO 8601, 미노출이면 null) */
  lastPromptedAt: string | null;
  /** 누적 노출 횟수 */
  count: number;
}

const KEY = 'aido_marketing_push_prompt';
const EMPTY_STATE: MarketingPushPromptState = { lastPromptedAt: null, count: 0 };

export function readMarketingPushPromptState(storage: SyncStorage): MarketingPushPromptState {
  const saved = storage.getString(KEY);

  if (!saved) {
    return { ...EMPTY_STATE };
  }

  try {
    const parsed: unknown = JSON.parse(saved);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'count' in parsed &&
      'lastPromptedAt' in parsed &&
      typeof parsed.count === 'number' &&
      (parsed.lastPromptedAt === null || typeof parsed.lastPromptedAt === 'string')
    ) {
      return { lastPromptedAt: parsed.lastPromptedAt, count: parsed.count };
    }

    return { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/** 프롬프트 노출 1회를 기록한다 (시각 갱신 + count 증가) */
export function recordMarketingPushPrompt(storage: SyncStorage, promptedAt: Date): void {
  const previous = readMarketingPushPromptState(storage);
  const next: MarketingPushPromptState = {
    lastPromptedAt: promptedAt.toISOString(),
    count: previous.count + 1,
  };
  storage.set(KEY, JSON.stringify(next));
}
