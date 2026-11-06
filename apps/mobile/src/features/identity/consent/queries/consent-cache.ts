import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import type { Consent } from '@src/features/identity/consent/schemas/consent.schema';
import type { QueryClient } from '@tanstack/react-query';

/**
 * 서버가 AI 데이터 제공 동의가 없다고 거절했을 때(AI_1311) 캐시를 서버 기준으로 맞춘다.
 * 다른 기기에서 철회했거나 안내 버전이 바뀐 경우라, 다음 AI 동작 전에 동의 안내를 다시 띄운다.
 */
export function markAiDataSharingConsentRequired(queryClient: QueryClient) {
  queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.consent(), (consent) =>
    consent == null
      ? consent
      : {
          ...consent,
          aiDataSharingDecision: AI_DATA_SHARING_DECISION.UNDECIDED,
          aiDataSharingAgreedAt: null,
        },
  );
}
