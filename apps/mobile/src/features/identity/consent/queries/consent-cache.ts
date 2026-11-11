import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import type { QueryClient } from '@tanstack/react-query';

import { CONSENT_QUERY_KEYS } from './consent-query-keys';
import type { useGetConsentQueryOptions } from './consent.queries';

/** 훅 밖에서 이미 받은 동의 상태만 읽는다. 받지 않았으면 없다 */
export function getCachedConsent(queryClient: QueryClient) {
  return queryClient.getQueryData(CONSENT_QUERY_KEYS.detail());
}

/** 받은 동의 상태가 있으면 그대로, 없으면 받는다 */
export function ensureConsent(
  queryClient: QueryClient,
  options: ReturnType<typeof useGetConsentQueryOptions>,
) {
  return queryClient.ensureQueryData(options);
}

/** AI_1311은 다른 기기에서 철회했거나 안내 버전이 바뀐 경우라 캐시를 서버 기준으로 맞춰 다음 AI 동작 전에 다시 묻는다 */
export function markAiDataSharingConsentRequired(queryClient: QueryClient) {
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (consent) =>
    consent == null
      ? consent
      : {
          ...consent,
          aiDataSharingDecision: AI_DATA_SHARING_DECISION.UNDECIDED,
          aiDataSharingAgreedAt: null,
        },
  );
}

export function invalidateConsent(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
}
