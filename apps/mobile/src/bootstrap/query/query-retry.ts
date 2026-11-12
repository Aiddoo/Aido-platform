import { isCodedError, isTransientError, ParseError } from '@src/shared/errors';

/** 그 밖의 실패(코드 버그·키체인 잠금·코드 없는 SDK 오류)의 재시도 상한 */
const MAX_RETRIES = 3;

/** 서버 재시작(≈5-10초)을 덮도록 넉넉히 잡는다 */
const TRANSIENT_INFRA_RETRIES = 6;

/** 일시 장애는 재시도 화면 대신 로딩을 유지하고, 다시 받아도 같은 실패는 바로 호출부와 `QueryErrorBoundary`에 넘긴다 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // 계약과 다른 응답은 다시 받아도 같다
  if (error instanceof ParseError) {
    return false;
  }
  if (isTransientError(error)) {
    return failureCount < TRANSIENT_INFRA_RETRIES;
  }
  // 서버 4xx와 코드로 거절한 앱·SDK 오류는 다시 해도 같은 판정이다
  if (isCodedError(error)) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}
