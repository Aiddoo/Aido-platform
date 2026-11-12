import { ApiError, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';

import { shouldRetryQuery } from './query-retry';

describe('shouldRetryQuery', () => {
  it('401/403 ApiError는 재시도하지 않는다 (세션 종료·권한 없음 → QueryErrorBoundary가 담음)', () => {
    // Given
    const unauthorized = new ApiError('AUTH_0105', '다시 로그인', 401);
    const forbidden = new ApiError('AUTH_0108', '권한 없음', 403);

    // When
    const retryUnauthorized = shouldRetryQuery(0, unauthorized);
    const retryForbidden = shouldRetryQuery(0, forbidden);

    // Then
    expect(retryUnauthorized).toBe(false);
    expect(retryForbidden).toBe(false);
  });

  it('그 외 BusinessError(예측 가능한 4xx)는 재시도하지 않는다', () => {
    // Given
    // 호출부가 onError에서 처리한다
    const businessError = new ApiError('MEMO_2001', '한도 초과', 409);

    // When
    const retry = shouldRetryQuery(0, businessError);

    // Then
    expect(retry).toBe(false);
  });

  it('일시 인프라 장애(네트워크·5xx·타임아웃)는 넉넉한 상한(6)까지 재시도한다', () => {
    // Given
    // 콜드 스타트/서버 재시작 구간에 서버 복귀를 기다린다(재시도 창 ≈ 22초)
    // 토큰 갱신의 일시 실패도 갱신기가 이 세 타입으로 던지므로 같은 창을 탄다.
    const cases = [
      new NetworkError(),
      new ServerError(500),
      new ServerError(503),
      new TimeoutError(),
    ];

    // When
    const decisions = cases.map((error) => [
      shouldRetryQuery(0, error),
      shouldRetryQuery(5, error),
      shouldRetryQuery(6, error),
    ]);

    // Then
    for (const decision of decisions) {
      expect(decision).toEqual([true, true, false]);
    }
  });
});
