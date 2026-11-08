import { PLAN_FEATURE_KEYS } from '@aido/api/vocabulary';
import { z } from 'zod';

const subscriptionViewSchema = z.enum(['status', 'plans']).catch('status');

export type SubscriptionView = z.output<typeof subscriptionViewSchema>;

/** `/settings/subscription` URL 값. `feature`는 막혀서 들어온 기능이고 모르는 값이면 없는 것으로 본다 */
export const subscriptionParamsSchema = z.object({
  view: subscriptionViewSchema,
  feature: z.enum(PLAN_FEATURE_KEYS).optional().catch(undefined),
});
