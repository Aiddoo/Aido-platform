import type { QueryClient } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import type { Consent } from '../domains/auth.model';

/**
 * 서버가 AI 데이터 제공 동의가 없다고 거절했을 때(AI_1311) 캐시를 서버 기준으로 맞춘다.
 * 다른 기기에서 철회했거나 안내 버전이 바뀐 경우라, 다음 AI 동작 전에 동의 안내를 다시 띄운다.
 */
export function markAiDataSharingConsentRequired(queryClient: QueryClient) {
  queryClient.setQueryData<Consent>(AUTH_QUERY_KEYS.consent(), (consent) =>
    consent == null
      ? consent
      : { ...consent, aiDataSharingDecision: 'UNDECIDED', aiDataSharingAgreedAt: null },
  );
}
