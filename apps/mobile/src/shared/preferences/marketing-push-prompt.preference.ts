import type { SyncStorage } from '@src/core/ports/sync-storage';
import { z } from 'zod';

/** 마케팅 푸시 옵트인 프롬프트의 도배 방지 상태 (MMKV 저장) */
export interface MarketingPushPromptState {
  /** 마지막으로 프롬프트를 노출한 시각 (ISO 8601, 미노출이면 null) */
  lastPromptedAt: string | null;
  /** 누적 노출 횟수 */
  count: number;
}

const KEY = 'aido_marketing_push_prompt';
// 저장소 오염 방어: 유효하지 않은 날짜 문자열은 null로 정규화해 재노출을 허용한다
// (invalid Date는 throw가 아니라 NaN이므로 하위 정책이 조용히 오작동하는 것을 차단)
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

export function readMarketingPushPromptState(storage: SyncStorage): MarketingPushPromptState {
  const saved = storage.getString(KEY);

  if (!saved) {
    return { ...EMPTY_STATE };
  }

  try {
    const parsed = savedStateSchema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : { ...EMPTY_STATE };
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
