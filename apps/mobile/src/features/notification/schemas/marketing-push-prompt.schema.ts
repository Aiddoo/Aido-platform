import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 마케팅 푸시 옵트인 배너의 도배 방지 상태 */
export const marketingPushPromptStateSchema = z.object({
  count: z.number(),
  lastPromptedAt: instantSchema.nullable().catch(null),
});
export type MarketingPushPromptState = z.infer<typeof marketingPushPromptStateSchema>;
