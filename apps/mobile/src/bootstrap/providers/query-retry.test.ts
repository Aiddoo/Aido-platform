import {
  ApiError,
  NetworkError,
  ServerError,
  TimeoutError,
  TransientAuthError,
} from '@src/shared/errors';
import { shouldRetryQuery } from './query-retry';

describe('shouldRetryQuery', () => {
  it('401/403 ApiError는 재시도하지 않는다 (세션 종료·권한 없음 → QueryErrorBoundary가 담음)', () => {
    // Given
    const unauthorized = new ApiError('AUTH_0105', '다시 로그인', 401);
    const forbidden = new ApiError('AUTH_0108', '권한 없음', 403);

    // When / Then
    expect(shouldRetryQuery(0, unauthorized)).toBe(false);
    expect(shouldRetryQuery(0, forbidden)).toBe(false);
  });

  it('그 외 BusinessError(예측 가능한 4xx)는 재시도하지 않는다', () => {
    // Given — 호출부가 onError에서 처리한다
    const businessError = new ApiError('MEMO_0301', '한도 초과', 409);

    // When / Then
    expect(shouldRetryQuery(0, businessError)).toBe(false);
  });

  it('일시 인프라 장애(네트워크·5xx·타임아웃·토큰 갱신 일시 실패)는 넉넉한 상한(6)까지 재시도한다', () => {
    // Given — 콜드 스타트/서버 재시작 구간에 서버 복귀를 기다린다(재시도 창 ≈ 22초)
    const cases = [
      new NetworkError(),
      new ServerError(503),
      new TimeoutError(),
      new TransientAuthError(),
    ];

    // When / Then
    for (const error of cases) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(5, error)).toBe(true);
      expect(shouldRetryQuery(6, error)).toBe(false);
    }
  });
});
