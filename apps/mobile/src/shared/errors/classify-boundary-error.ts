import { ErrorCode } from '@aido/api/errors';

import { isApiError } from './api-error';

/**
 * ErrorBoundary가 잡은 에러의 처리 종류.
 *
 * - `auth-transition`: 세션이 끝난 뒤 도착한 401. 라우트 게이트가 곧 로그인 화면으로 바꾸므로
 *   화면·리포트 없이 조용히 넘긴다.
 * - `expected-state`: 404 ApiError 또는 기능이 꺼진 4xx(`FEATURE_UNAVAILABLE_CODES`). 대상이 없거나
 *   아직 등록되지 않았거나 지금 쓸 수 없는 상태로, fallback이 안내 화면을 그린다.
 *   장애가 아니므로 예외 리포트 대신 breadcrumb만 남긴다.
 * - `error`: 진짜 장애(5xx·네트워크·파싱 등). 에러 화면 + 리포트.
 */
export type BoundaryErrorKind = 'auth-transition' | 'expected-state' | 'error';

/**
 * 던져진 에러가 "401(인증 계열)"인지 "진짜 장애"인지만 판정하는 순수 함수.
 *
 * **의도적으로 인증 상태(`status`)를 보지 않는다** — 레이스 프리하게 유지하기 위해서다.
 * 401을 실제 세션 종료(→로그인 게이트, 조용히 넘김)로 볼지, 컨테인먼트 구멍으로 새어온
 * 살아있는 세션의 401(→재시도 UI + 리포트)로 볼지의 **최종 판단은 호출부(앱 레벨 바운더리)**
 * 가 `status`와 결합해 내린다(`app/(app)/_layout.tsx` 안전망 참조). 이 함수는 그 판단의
 * 한 축(에러 종류)만 제공한다.
 */
/** 서버 플래그로 기능이 꺼졌다는 코드. fallback이 "지금은 쓸 수 없음"을 그린다 */
const FEATURE_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([ErrorCode.INVITE_2105]);

export const classifyBoundaryError = (error: unknown): BoundaryErrorKind => {
  if (isApiError(error) && error.status === 401) {
    return 'auth-transition';
  }

  if (isApiError(error) && (error.status === 404 || FEATURE_UNAVAILABLE_CODES.has(error.code))) {
    return 'expected-state';
  }

  return 'error';
};
