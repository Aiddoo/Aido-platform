import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import type { QueryClient } from '@tanstack/react-query';

import { CONSENT_QUERY_KEYS } from '../constants/consent-query-keys';
import { type Consent } from '../domains/consent.model';

// AI_1311: 다른 기기 철회나 안내 버전 변경이라 캐시를 서버 기준으로 맞춰 다음 AI 동작 전에 다시 안내한다
export function markAiDataSharingConsentRequired(queryClient: QueryClient) {
  queryClient.setQueryData<Consent>(CONSENT_QUERY_KEYS.detail(), (consent) =>
    consent == null
      ? consent
      : {
          ...consent,
          aiDataSharingDecision: AI_DATA_SHARING_DECISION.UNDECIDED,
          aiDataSharingAgreedAt: null,
        },
  );
}
