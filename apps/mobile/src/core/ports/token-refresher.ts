import type { SessionExpiredDetails } from '@src/core/observability/telemetry-event';

/** 리프레시 요청 포트. 소비자(갱신기)가 선언하고 인프라(`refresh-tokens-request`)가 구현한다. */
export type RefreshTokensRequest = (refreshToken: string) => Promise<Response>;

// refreshed는 재시도 훅이 주입할 새 액세스 토큰을 싣는다(ky v2 beforeRequest는 재시도 시 다시 실행되지 않는다)
// invalid는 세션 종료가 확정적이다(서버가 준 ErrorCode가 있으면 실어 보낸다)
// superseded는 갱신 도중 세션이 끝난 것이라 저장도 종료도 하지 않는다(로그아웃한 토큰이 되살아나거나 다음 계정의 토큰이 지워진다)
// 일시 실패는 판정이 아니라 인프라 에러로 throw해 React Query 재시도 정책이 처리한다
export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string }
  | { kind: 'invalid'; details: SessionExpiredDetails }
  | { kind: 'superseded' };

export type TokenRefresher = () => Promise<RefreshOutcome>;
