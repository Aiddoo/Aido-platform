import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISIONS } from '@aido/api/vocabulary';
import { z } from 'zod';

export const consentSchema = z.object({
  termsAgreedAt: z.coerce.date().nullable(),
  privacyAgreedAt: z.coerce.date().nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: z.coerce.date().nullable(),
  marketingPushAgreedAt: z.coerce.date().nullable(),
  aiDataSharingDecision: z.enum(AI_DATA_SHARING_DECISIONS),
  aiDataSharingAgreedAt: z.coerce.date().nullable(),
  /** 마지막으로 답한 안내 버전. 답한 적이 없거나 서버가 주지 않으면 null */
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

export const ConsentPolicy = {
  /** 이전 안내 버전 동의도 AGREED다. 서버가 그 버전의 처리 업체만 쓰므로 기능은 그대로 동작한다 */
  hasAgreedToAiDataSharing: (consent: Consent): boolean =>
    consent.aiDataSharingDecision === 'AGREED',
  /** 이전 안내에 동의한 사람에게 바뀐 안내를 보여 줘야 하는지. 버전을 모르면 묻지 않는다 */
  shouldShowAiConsentRenewal: (consent: Consent): boolean =>
    consent.aiDataSharingDecision === 'AGREED' &&
    consent.aiDataSharingConsentVersion != null &&
    consent.aiDataSharingConsentVersion !== AI_DATA_SHARING_CONSENT.VERSION,
} as const;

export const updateMarketingConsentResultSchema = z.object({
  marketingAgreedAt: z.coerce.date().nullable(),
});
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

export const updateMarketingPushConsentResultSchema = z.object({
  marketingPushAgreedAt: z.coerce.date().nullable(),
});
export type UpdateMarketingPushConsentResult = z.infer<
  typeof updateMarketingPushConsentResultSchema
>;

export const updateAiDataSharingConsentResultSchema = consentSchema.pick({
  aiDataSharingDecision: true,
  aiDataSharingAgreedAt: true,
  aiDataSharingConsentVersion: true,
});
export type UpdateAiDataSharingConsentResult = z.infer<
  typeof updateAiDataSharingConsentResultSchema
>;
