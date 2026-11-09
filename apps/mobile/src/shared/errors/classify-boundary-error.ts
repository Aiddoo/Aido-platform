import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/core/errors/api-error';

/** auth-transition은 라우트 게이트가 곧 로그인 화면으로 바꾸므로 조용히 넘기고, expected-state는 장애가 아니라 breadcrumb만 남긴다 */
export type BoundaryErrorKind = 'auth-transition' | 'expected-state' | 'error';

/** 서버 플래그로 기능이 꺼졌다는 코드. fallback이 "지금은 쓸 수 없음"을 그린다 */
const FEATURE_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([ErrorCode.INVITE_2105]);

/** 401의 최종 판단은 호출부(`app/(app)/_layout.tsx` 안전망)가 `status`와 결합해 내리므로 인증 상태를 보지 않는다 */
export function classifyBoundaryError(error: unknown): BoundaryErrorKind {
  if (isApiError(error) && error.status === 401) {
    return 'auth-transition';
  }

  if (isApiError(error) && (error.status === 404 || FEATURE_UNAVAILABLE_CODES.has(error.code))) {
    return 'expected-state';
  }

  return 'error';
}
