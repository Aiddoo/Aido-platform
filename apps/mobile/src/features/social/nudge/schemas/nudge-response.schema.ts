import { nudgeThanksPreviewResponseSchema } from '@aido/api';
import type { z } from 'zod';

/** 지금 서버는 감사 기록 두 칸을 항상 싣는다. 쪽 정보(totalRecipients·nextCursor·hasNext)는 쪽을 요청했을 때만 있다 */
export const nudgeThanksPreviewEnvelopeSchema = nudgeThanksPreviewResponseSchema.required({
  thankedRecipientCount: true,
  lastThankedAt: true,
});
export type NudgeThanksPreviewEnvelope = z.output<typeof nudgeThanksPreviewEnvelopeSchema>;
