import { isApiError } from './api-error';

/**
 * ErrorBoundary가 잡은 에러의 처리 종류.
 *
 * - `auth-transition`: 세션이 끝난 뒤 도착한 401. 라우트 게이트가 곧 로그인 화면으로 바꾸므로
 *   화면·리포트 없이 조용히 넘긴다.
 * - `error`: 진짜 장애(5xx·네트워크·파싱 등). 에러 화면 + 리포트.
 */
export type BoundaryErrorKind = 'auth-transition' | 'error';

/**
 * 앱 레벨 라우트 바운더리에 도달한 에러를 처리 종류로 분류한다.
 *
 * **레이스 비의존**: 살아있는 세션의 일시적 401은 화면별 `QueryErrorBoundary`가 로컬 재시도로
 * 담으므로, 앱 레벨 바운더리까지 도달하는 401 `ApiError`는 진짜 세션 종료(`session-invalid`/
 * `no-session`)로 본다. 인증 상태(`status`)를 볼 필요 없이 로그인 전환으로 판정한다
 * (과거 `status !== 'authenticated'` 레이스 제거).
 */
export const classifyBoundaryError = (error: unknown): BoundaryErrorKind => {
  if (isApiError(error) && error.status === 401) {
    return 'auth-transition';
  }

  return 'error';
};
