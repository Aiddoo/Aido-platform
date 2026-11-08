import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 출시된 앱이 쓰던 JSON 모양 그대로다. 시각으로 읽을 수 없는 값은 null로 바꿔 다시 보이게 한다 */
export const marketingPushPromptStateSchema = z.object({
  count: z.number(),
  lastPromptedAt: instantSchema.nullable().catch(null),
});
export type MarketingPushPromptState = z.infer<typeof marketingPushPromptStateSchema>;
