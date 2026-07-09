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
 * 던져진 에러가 "401(인증 계열)"인지 "진짜 장애"인지만 판정하는 순수 함수.
 *
 * **의도적으로 인증 상태(`status`)를 보지 않는다** — 레이스 프리하게 유지하기 위해서다.
 * 401을 실제 세션 종료(→로그인 게이트, 조용히 넘김)로 볼지, 컨테인먼트 구멍으로 새어온
 * 살아있는 세션의 401(→재시도 UI + 리포트)로 볼지의 **최종 판단은 호출부(앱 레벨 바운더리)**
 * 가 `status`와 결합해 내린다(`app/(app)/_layout.tsx` 안전망 참조). 이 함수는 그 판단의
 * 한 축(에러 종류)만 제공한다.
 */
export const classifyBoundaryError = (error: unknown): BoundaryErrorKind => {
  if (isApiError(error) && error.status === 401) {
    return 'auth-transition';
  }

  return 'error';
};
