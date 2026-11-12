import { isCodedError, isTransientError } from '@src/shared/errors';

/** 재시도 상한(그 외 — 예: 응답 파싱 실패). */
const MAX_RETRIES = 3;

/** 서버 재시작(≈5-10초)을 덮도록 넉넉히 잡는다 */
const TRANSIENT_INFRA_RETRIES = 6;

/** 서버 4xx와 `code`가 있는 앱 오류는 호출부와 `QueryErrorBoundary`가 처리하므로 재시도하지 않는다. 일시 인프라 장애는 재시도 화면 대신 로딩을 유지한다 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isCodedError(error)) {
    return false;
  }

  if (isTransientError(error)) {
    return failureCount < TRANSIENT_INFRA_RETRIES;
  }

  return failureCount < MAX_RETRIES;
}
