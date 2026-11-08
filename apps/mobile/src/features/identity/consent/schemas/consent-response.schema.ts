import { consentResponseSchema } from '@aido/api';
import type { z } from 'zod';

// 구버전 서버 때문에 계약은 선택 칸이지만 지금 서버는 항상 싣는다
export const consentEnvelopeSchema = consentResponseSchema.required({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type ConsentEnvelope = z.infer<typeof consentEnvelopeSchema>;
