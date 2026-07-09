import { ApiError } from './api-error';
import { classifyBoundaryError } from './classify-boundary-error';
import { ServerError } from './infra-error';

describe('classifyBoundaryError', () => {
  it('401 ApiError는 auth-transition으로 분류한다 (인증 상태와 무관 — 레이스 제거)', () => {
    // Given — 살아있는 세션의 401은 화면별 QueryErrorBoundary가 담으므로,
    // 앱 레벨 바운더리에 도달하는 401 ApiError는 진짜 세션 종료뿐이다.
    const error = new ApiError('AUTH_0105', '다시 로그인', 401);

    // When / Then
    expect(classifyBoundaryError(error)).toBe('auth-transition');
  });

  it('403 ApiError는 error로 분류한다 (권한 없음은 인증 전환이 아니다)', () => {
    // Given
    const error = new ApiError('AUTH_0108', '권한 없음', 403);

    // When / Then
    expect(classifyBoundaryError(error)).toBe('error');
  });

  it('5xx·기타 인프라 에러는 error로 분류한다', () => {
    // Given
    const error = new ServerError(500);

    // When / Then
    expect(classifyBoundaryError(error)).toBe('error');
  });
});
