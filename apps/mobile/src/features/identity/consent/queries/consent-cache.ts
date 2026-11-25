import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { settleOverlappingWrite } from '@src/shared/query/settle-overlapping-write';
import type {
  DefaultError,
  QueryExecuteOptions,
  MutationKey,
  Query,
  QueryClient,
} from '@tanstack/react-query';

import type { Consent } from '../domains/consent.model';
import { CONSENT_QUERY_KEYS } from './consent-query-keys';

/** 조회 함수가 DI Api를 써서 `useGetConsentQueryOptions`가 만든다 */
type ConsentQueryOptions = QueryExecuteOptions<
  Consent,
  DefaultError,
  Consent,
  Consent,
  ReturnType<typeof CONSENT_QUERY_KEYS.detail>
>;

/** 훅 밖에서 이미 받은 동의 상태만 읽는다. 받지 않았으면 없다 */
export function getCachedConsent(queryClient: QueryClient) {
  return queryClient.getQueryData(CONSENT_QUERY_KEYS.detail());
}

/** 받은 동의 상태가 있으면 그대로, 없으면 받는다 */
export function ensureConsent(queryClient: QueryClient, options: ConsentQueryOptions) {
  return queryClient.query({ ...options, staleTime: 'static' });
}

export function cancelConsent(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
}

/** 받은 동의 상태가 있을 때만 바꾼다. 받기 전이면 그대로 둬 다음 조회가 서버 값을 쓴다 */
export function setConsentInCache(queryClient: QueryClient, update: (consent: Consent) => Consent) {
  queryClient.setQueryData(CONSENT_QUERY_KEYS.detail(), (consent) =>
    consent == null ? consent : update(consent),
  );
}

/** AI_1311은 다른 기기에서 철회했거나 안내 버전이 바뀐 경우라 캐시를 서버 기준으로 맞춰 다음 AI 동작 전에 다시 묻는다 */
export function markAiDataSharingConsentRequired(queryClient: QueryClient) {
  setConsentInCache(queryClient, (consent) => ({
    ...consent,
    aiDataSharingDecision: AI_DATA_SHARING_DECISION.UNDECIDED,
    aiDataSharingAgreedAt: null,
  }));
}

/** 동의 하나를 바꾼 응답을 쓴다. 같은 동의를 겹쳐 바꿨으면 응답 대신 마지막에 서버 값을 다시 받는다 */
export function settleConsentResponse(
  queryClient: QueryClient,
  {
    mutationKey,
    startedWithOthers,
    writeResponse,
  }: { mutationKey: MutationKey; startedWithOthers: boolean; writeResponse: () => void },
) {
  return settleOverlappingWrite(queryClient, {
    mutationKey,
    queryKey: CONSENT_QUERY_KEYS.detail(),
    startedWithOthers,
    writeResponse,
  });
}

export function invalidateConsent(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: CONSENT_QUERY_KEYS.detail() });
}

/** 조회 옵션이 `meta.refreshOnAiConsentChange`로 AI 동의에 따라 서버 상태가 달라진다고 밝힌 쿼리 */
function isAiConsentDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnAiConsentChange === true;
}

export function invalidateAiConsentDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isAiConsentDependentQuery });
}
