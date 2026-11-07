import { consentResponseSchema, type UpdateMarketingConsentInput } from '@aido/api';
import { AI_DATA_SHARING_DECISIONS } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 지금 서버는 AI 데이터 처리 동의 세 칸을 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const consentEnvelopeSchema = consentResponseSchema.required({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type ConsentEnvelope = z.infer<typeof consentEnvelopeSchema>;

const consentSchema = z.object({
  termsAgreedAt: instantSchema.nullable(),
  privacyAgreedAt: instantSchema.nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: instantSchema.nullable(),
  marketingPushAgreedAt: instantSchema.nullable(),
  aiDataSharingDecision: z.enum(AI_DATA_SHARING_DECISIONS),
  aiDataSharingAgreedAt: instantSchema.nullable(),
  /** 마지막으로 답한 안내 버전. 답한 적이 없으면 null */
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

const updateMarketingConsentResultSchema = consentSchema.pick({ marketingAgreedAt: true });
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

const updateMarketingPushConsentResultSchema = consentSchema.pick({
  marketingPushAgreedAt: true,
});
export type UpdateMarketingPushConsentResult = z.infer<
  typeof updateMarketingPushConsentResultSchema
>;

const updateAiDataSharingConsentResultSchema = consentSchema.pick({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type UpdateAiDataSharingConsentResult = z.infer<
  typeof updateAiDataSharingConsentResultSchema
>;

/** 동의했는지만 바꾼다. 마케팅·광고성 푸시·AI 데이터 제공이 같은 모양이다 */
export type ConsentAgreement = Pick<UpdateMarketingConsentInput, 'agreed'>;
