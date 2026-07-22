import type { Consent } from '@src/features/auth/models/auth.model';
import type { MarketingPushPromptState } from '@src/shared/preferences/marketing-push-prompt.preference';

/** 마지막 노출 이후 재노출까지의 쿨다운(일) */
const COOLDOWN_DAYS = 14;
/** 명시적 닫기 누적 상한 — 초과 시 영구 침묵 */
const MAX_PROMPT_COUNT = 3;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** 아직 광고성 푸시 수신에 동의하지 않았는가 */
export function isNotAgreedToMarketingPush(consent: Consent): boolean {
  return consent.marketingPushAgreedAt === null;
}

/** 닫기 횟수가 상한 미만인가 */
export function isUnderPromptLimit(promptState: MarketingPushPromptState): boolean {
  return promptState.count < MAX_PROMPT_COUNT;
}

/** 마지막 닫기 이후 쿨다운이 경과했는가 (닫은 적 없으면 즉시 true) */
export function hasCooldownElapsed(promptState: MarketingPushPromptState): boolean {
  if (promptState.lastPromptedAt === null) {
    return true;
  }

  const elapsedMs = Date.now() - new Date(promptState.lastPromptedAt).getTime();
  return elapsedMs >= COOLDOWN_DAYS * MILLISECONDS_PER_DAY;
}

/**
 * 마케팅 푸시 옵트인 배너 노출 정책.
 *
 * 순수 조건 함수들을 조합한다 — 규칙을 추가하려면 `&&` 한 줄만 더한다.
 * (동의 정보 로딩 전에는 노출하지 않는다)
 */
export const MarketingPushPromptPolicy = {
  shouldPrompt(consent: Consent | undefined, promptState: MarketingPushPromptState): boolean {
    if (consent == null) {
      return false;
    }

    return (
      isNotAgreedToMarketingPush(consent) &&
      isUnderPromptLimit(promptState) &&
      hasCooldownElapsed(promptState)
    );
  },
} as const;
