import { AI_DATA_SHARING_CONSENT, AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';

import type { Consent } from '../schemas/consent.schema';

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
