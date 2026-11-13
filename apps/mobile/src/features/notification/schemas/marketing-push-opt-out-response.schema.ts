import { marketingPushOptOutResponseSchema } from '@aido/api';
import type { z } from 'zod';

/** 지금 서버는 처리 시각을 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const marketingPushOptOutEnvelopeSchema = marketingPushOptOutResponseSchema.required({
  marketingPushWithdrawnAt: true,
});
export type MarketingPushOptOutEnvelope = z.infer<typeof marketingPushOptOutEnvelopeSchema>;
