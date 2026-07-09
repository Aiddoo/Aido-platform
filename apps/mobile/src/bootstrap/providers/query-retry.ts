import { isApiError, isBusinessError } from '@src/shared/errors';

/** 재시도 상한. */
const MAX_RETRIES = 3;

/**
 * React Query 쿼리 재시도 술어.
 *
 * - `ApiError` 401/403(세션 종료·권한 없음): 재시도하지 않는다. 401은 인터셉터가 이미 한 번
 *   갱신·재시도했고, 남은 401은 화면별 `QueryErrorBoundary`가 로컬 재시도로 담는다.
 * - 그 외 `BusinessError`(예측 가능한 4xx): 재시도하지 않는다 — 호출부가 처리한다.
 * - 나머지(네트워크·5xx 등): 상한까지 재시도한다.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (isApiError(error) && [401, 403].includes(error.status)) {
    return false;
  }

  if (isBusinessError(error)) {
    return false;
  }

  return failureCount < MAX_RETRIES;
};
