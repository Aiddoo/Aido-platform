import type { Consent } from '@src/features/identity/consent/schemas/consent.schema';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';

import type { MarketingPushPromptState } from '../schemas/marketing-push-prompt.schema';

const COOLDOWN_DAYS = 14;
/** 명시적 닫기 누적 상한 — 초과 시 영구 침묵 */
const MAX_PROMPT_COUNT = 3;

function isNotAgreedToMarketingPush(consent: Pick<Consent, 'marketingPushAgreedAt'>): boolean {
  return consent.marketingPushAgreedAt == null;
}

function isUnderPromptLimit(promptState: MarketingPushPromptState): boolean {
  return promptState.count < MAX_PROMPT_COUNT;
}

/** 마지막 닫기 이후 쿨다운이 경과했는가 (닫은 적 없으면 즉시 true) */
function hasCooldownElapsed(promptState: MarketingPushPromptState, now: Instant): boolean {
  if (promptState.lastPromptedAt == null) {
    return true;
  }

  return diffMs(now, promptState.lastPromptedAt) >= COOLDOWN_DAYS * DAY_MS;
}

/** 동의 정보 로딩 전에는 노출하지 않는다. 규칙을 추가하려면 조건 함수를 하나 더 조합한다. */
function shouldPrompt(
  consent: Pick<Consent, 'marketingPushAgreedAt'> | undefined,
  promptState: MarketingPushPromptState,
  now: Instant,
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
  shouldPrompt,
} as const;
