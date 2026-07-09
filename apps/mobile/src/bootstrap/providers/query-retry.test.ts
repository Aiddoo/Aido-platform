import { ApiError, NetworkError } from '@src/shared/errors';
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

  it('네트워크·5xx 등은 상한(3)까지 재시도한다', () => {
    // Given
    const error = new NetworkError();

    // When / Then
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });
});
