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

/** 동의 모델에서 이 판단이 보는 칸. 동의 기능의 모델을 import하지 않고 모양으로 받는다 */
interface MarketingPushConsent {
  marketingPushAgreedAt: Instant | null;
}

interface ShouldPromptContext {
  consent: MarketingPushConsent;
  now: Instant;
}

function hasCooldownElapsed(prompt: MarketingPushPromptState, now: Instant): boolean {
  if (prompt.dismissedAt == null) {
    return true;
  }
  return diffMs(now, prompt.dismissedAt) >= DECLINE_COOLDOWN_DAYS * DAY_MS;
}

/** 이미 동의했거나 거절한 지 90일이 안 됐으면 제안하지 않는다 */
function shouldPrompt(prompt: MarketingPushPromptState, { consent, now }: ShouldPromptContext) {
  return consent.marketingPushAgreedAt == null && hasCooldownElapsed(prompt, now);
}

export const MarketingPushPromptPolicy = {
  shouldPrompt,
} as const;
