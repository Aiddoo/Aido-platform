import { type Consent } from '@src/features/identity/consent/domains/consent.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant, instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 계정마다 혜택·소식 제안을 마지막으로 닫은 시각 */
export const marketingPushPromptStateSchema = z.object({
  dismissedAt: instantSchema.nullable(),
});
export type MarketingPushPromptState = z.infer<typeof marketingPushPromptStateSchema>;

/** 거절하면 이 날수 동안 다시 제안하지 않는다 */
const DECLINE_COOLDOWN_DAYS = 90;

function hasAgreedToMarketingPush(consent: Pick<Consent, 'marketingPushAgreedAt'>): boolean {
  return consent.marketingPushAgreedAt != null;
}

function hasCooldownElapsed(promptState: MarketingPushPromptState, now: Instant): boolean {
  if (promptState.dismissedAt == null) {
    return true;
  }
  return diffMs(now, promptState.dismissedAt) >= DECLINE_COOLDOWN_DAYS * DAY_MS;
}

/** 이미 동의했거나 거절한 지 90일이 안 됐으면 제안하지 않는다 */
function shouldPrompt(
  consent: Consent,
  promptState: MarketingPushPromptState,
  now: Instant,
): boolean {
  return !hasAgreedToMarketingPush(consent) && hasCooldownElapsed(promptState, now);
}

export const MarketingPushPromptPolicy = {
  shouldPrompt,
} as const;
