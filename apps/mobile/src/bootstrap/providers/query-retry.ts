import {
  isApiError,
  isBusinessError,
  NetworkError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors';

/** 재시도 상한(그 외 — 예: 응답 파싱 실패). */
const MAX_RETRIES = 3;

/**
 * 일시 인프라 장애 재시도 상한. 서버 재시작(≈5-10초)을 덮도록 넉넉히 잡는다.
 * `query-provider`의 상한 백오프와 합치면 재시도 창 ≈ 22초.
 */
const TRANSIENT_INFRA_RETRIES = 6;

/**
 * "일시적 인프라 장애" — 서버 재시작·배포 구간에 자동 복구시킬 대상.
 * - `NetworkError`: 연결 거부(서버 재실행 시 대부분 이 형태). 토큰 갱신의 일시 실패도 포함.
 * - `ServerError`(5xx)·`TimeoutError`: 서버 부팅 중 502/503·느린 응답.
 * `ParseError`(응답 파싱 실패)는 재시도해도 안 낫으므로 제외 — 기본 상한(MAX_RETRIES)로.
 */
const isRetryableInfraError = (error: unknown): boolean =>
  error instanceof NetworkError || error instanceof ServerError || error instanceof TimeoutError;

/**
 * React Query 쿼리 재시도 술어.
 *
 * - `ApiError` 401/403(세션 종료·권한 없음): 재시도하지 않는다 — 화면별 `QueryErrorBoundary`가 담는다.
 * - 그 외 `BusinessError`(예측 가능한 4xx): 재시도하지 않는다 — 호출부가 처리한다.
 * - 일시 인프라 장애(네트워크·5xx·타임아웃): 넉넉한 상한까지 재시도해 서버 복귀를
 *   기다린다(콜드스타트/배포 재시작 구간에 재시도 화면 대신 로딩 유지).
 * - 나머지: 기본 상한까지 재시도한다.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (isApiError(error) && [401, 403].includes(error.status)) {
    return false;
  }

  if (isBusinessError(error)) {
    return false;
  }

  if (isRetryableInfraError(error)) {
    return failureCount < TRANSIENT_INFRA_RETRIES;
  }

  return failureCount < MAX_RETRIES;
};
