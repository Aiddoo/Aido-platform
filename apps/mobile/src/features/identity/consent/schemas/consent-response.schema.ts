import {
  consentResponseSchema,
  updateMarketingConsentResponseSchema,
  updateMarketingPushConsentResponseSchema,
} from '@aido/api';
import type { z } from 'zod';

/** 지금 서버는 AI 데이터 처리 동의 세 칸을 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const consentEnvelopeSchema = consentResponseSchema.required({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type ConsentEnvelope = z.infer<typeof consentEnvelopeSchema>;

/** 지금 서버는 철회 처리 시각 칸을 항상 싣는다(동의면 null) */
export const updateMarketingConsentEnvelopeSchema = updateMarketingConsentResponseSchema.required({
  marketingWithdrawnAt: true,
});
export type UpdateMarketingConsentEnvelope = z.infer<typeof updateMarketingConsentEnvelopeSchema>;

export const updateMarketingPushConsentEnvelopeSchema =
  updateMarketingPushConsentResponseSchema.required({ marketingPushWithdrawnAt: true });
export type UpdateMarketingPushConsentEnvelope = z.infer<
  typeof updateMarketingPushConsentEnvelopeSchema
>;
