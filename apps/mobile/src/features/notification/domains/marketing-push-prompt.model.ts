import type { Consent } from '@src/features/identity/consent/domains/consent.model';
import { DAY_MS } from '@src/shared/constants/time.constants';

/** 마케팅 푸시 옵트인 배너의 도배 방지 상태 */
export interface MarketingPushPromptState {
  /** 마지막으로 노출한 시각 (ISO 8601, 노출 전이면 null) */
  lastPromptedAt: string | null;
  /** 누적 노출 횟수 */
  count: number;
}

const COOLDOWN_DAYS = 14;
/** 명시적 닫기 누적 상한 — 초과 시 영구 침묵 */
const MAX_PROMPT_COUNT = 3;

export function isNotAgreedToMarketingPush(consent: Consent): boolean {
  return consent.marketingPushAgreedAt == null;
}

export function isUnderPromptLimit(promptState: MarketingPushPromptState): boolean {
  return promptState.count < MAX_PROMPT_COUNT;
}

/** 마지막 닫기 이후 쿨다운이 경과했는가 (닫은 적 없으면 즉시 true) */
export function hasCooldownElapsed(promptState: MarketingPushPromptState, now: Date): boolean {
  if (promptState.lastPromptedAt == null) {
    return true;
  }

  const elapsedMs = now.getTime() - new Date(promptState.lastPromptedAt).getTime();
  return elapsedMs >= COOLDOWN_DAYS * DAY_MS;
}

/** 동의 정보 로딩 전에는 노출하지 않는다. 규칙을 추가하려면 조건 함수를 하나 더 조합한다. */
function shouldPromptMarketingPush(
  consent: Consent | undefined,
  promptState: MarketingPushPromptState,
  now: Date,
): boolean {
  if (consent == null) {
    return false;
  }

  return (
    isNotAgreedToMarketingPush(consent) &&
    isUnderPromptLimit(promptState) &&
    hasCooldownElapsed(promptState, now)
  );
}

export const MarketingPushPromptPolicy = {
  shouldPrompt: shouldPromptMarketingPush,
} as const;
