import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { isApiError } from '@src/core/errors/api-error';

/** auth-transition은 라우트 게이트가 곧 로그인 화면으로 바꾸므로 조용히 넘기고, expected-state는 장애가 아니라 breadcrumb만 남긴다 */
export type BoundaryErrorKind = 'auth-transition' | 'expected-state' | 'error';

/**
 * 다시 시도해도 같은 업무 상태라 fallback이 안내를 그리는 코드.
 * INVITE_2105는 서버 플래그로 꺼진 기능, FOLLOW_0906은 친구가 끊거나 차단해 더는 볼 수 없는 친구의 할 일·완료 현황이다
 */
const EXPECTED_STATE_CODES: ReadonlySet<string> = new Set([
  ErrorCode.INVITE_2105,
  ErrorCode.FOLLOW_0906,
]);

/** 401의 최종 판단은 호출부(`app/(app)/_layout.tsx` 안전망)가 `status`와 결합해 내리므로 인증 상태를 보지 않는다 */
export function classifyBoundaryError(error: unknown): BoundaryErrorKind {
  if (isApiError(error) && error.status === HttpStatus.UNAUTHORIZED) {
    return 'auth-transition';
  }

  if (
    isApiError(error) &&
    (error.status === HttpStatus.NOT_FOUND || EXPECTED_STATE_CODES.has(error.code))
  ) {
    return 'expected-state';
  }

  return 'error';
}
