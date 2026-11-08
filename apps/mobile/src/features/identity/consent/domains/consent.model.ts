import {
  AI_DATA_SHARING_CONSENT,
  AI_DATA_SHARING_DECISION,
  AI_DATA_SHARING_DECISIONS,
} from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const consentSchema = z.object({
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

const updateMarketingConsentResultSchema = z.object({
  marketingAgreedAt: instantSchema.nullable(),
  /** 이번 요청으로 철회를 처리한 서버 시각. 동의했거나 구 서버면 null */
  marketingWithdrawnAt: instantSchema.nullable(),
});
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

const updateMarketingPushConsentResultSchema = z.object({
  marketingPushAgreedAt: instantSchema.nullable(),
  marketingPushWithdrawnAt: instantSchema.nullable(),
});
export type UpdateMarketingPushConsentResult = z.infer<
  typeof updateMarketingPushConsentResultSchema
>;

const updateAiDataSharingConsentResultSchema = z.object({
  aiDataSharingDecision: z.enum(AI_DATA_SHARING_DECISIONS),
  aiDataSharingAgreedAt: instantSchema.nullable(),
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type UpdateAiDataSharingConsentResult = z.infer<
  typeof updateAiDataSharingConsentResultSchema
>;

/** 이전 안내 버전 동의도 AGREED다. 서버가 그 버전의 처리 업체만 쓰므로 기능은 그대로 동작한다 */
function hasAgreedToAiDataSharing(consent: Pick<Consent, 'aiDataSharingDecision'>) {
  return consent.aiDataSharingDecision === AI_DATA_SHARING_DECISION.AGREED;
}

/** 이전 안내에 동의한 사람에게 바뀐 안내를 보여 줘야 하는지. 버전을 모르면 묻지 않는다 */
function shouldShowAiConsentRenewal(
  consent: Pick<Consent, 'aiDataSharingDecision' | 'aiDataSharingConsentVersion'>,
) {
  return (
    hasAgreedToAiDataSharing(consent) &&
    consent.aiDataSharingConsentVersion != null &&
    consent.aiDataSharingConsentVersion !== AI_DATA_SHARING_CONSENT.VERSION
  );
}

export const ConsentPolicy = {
  hasAgreedToAiDataSharing,
  shouldShowAiConsentRenewal,
} as const;
