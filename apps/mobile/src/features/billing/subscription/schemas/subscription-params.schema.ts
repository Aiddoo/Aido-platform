import { PLAN_FEATURE_KEYS } from '@aido/api/vocabulary';
import { z } from 'zod';

const subscriptionViewSchema = z.enum(['status', 'plans']).catch('status');

export type SubscriptionView = z.output<typeof subscriptionViewSchema>;

/** `feature`는 막혀서 들어온 기능(모르면 없음), `plan`은 링크가 미리 고르는 스토어 패키지 id(없으면 기본 요금제)다 */
export const subscriptionParamsSchema = z.object({
  view: subscriptionViewSchema,
  feature: z.enum(PLAN_FEATURE_KEYS).optional().catch(undefined),
  plan: z.string().min(1).optional().catch(undefined),
});
