import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';

/** 리프레시 요청 포트. 소비자(갱신기)가 선언하고 인프라(`refresh-tokens-request`)가 구현한다. */
export type RefreshTokensRequest = (refreshToken: string) => Promise<Response>;

/**
 * 갱신 시도의 판정.
 *
 * - `refreshed`: 새 토큰 쌍을 저장했다. 재시도 훅이 재시도 요청에 주입할 새 액세스
 *   토큰을 함께 싣는다(ky v2의 beforeRequest는 재시도 시 다시 실행되지 않는다).
 * - `invalid`: 세션 종료가 확정적이다(서버 거부·응답 스키마 위반·로컬 토큰 없음).
 *   서버가 준 `ErrorCode`가 있으면 그대로 실어 보낸다(진실의 원천은 서버다).
 * - `superseded`: 갱신 도중 세션이 끝났다. 이 응답은 지난 세션의 것이라 저장도, 세션 종료도
 *   하지 않는다. 받아들이면 로그아웃한 토큰이 되살아나거나 다음 계정의 토큰이 지워진다.
 *
 * 일시 실패(네트워크·타임아웃·429/5xx·키체인 잠김·저장 실패)는 판정이 아니라 **인프라
 * 에러로 throw**된다 — 보유 토큰은 유효하므로 React Query의 재시도 정책이 처리한다.
 */
export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string }
  | { kind: 'invalid'; details: SessionExpiredDetails }
  | { kind: 'superseded' };

export type TokenRefresher = () => Promise<RefreshOutcome>;
