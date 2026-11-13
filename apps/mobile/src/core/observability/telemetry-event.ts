import type { ErrorCodeType } from '@aido/api/errors';
import type { Severity } from '@src/core/observability/severity';

/** 세션 유효성은 서버가 진실의 원천이라 클라이언트는 "왜 종료했는가"의 결정 경로만 기록한다. refresh-rejected일 때만 서버 판정(`serverErrorCode`)이 있고, HTTP 상태는 전송 계층 사정이라 이름에 넣지 않는다 */
export type SessionExpiredReason =
  | 'refresh-rejected'
  | 'invalid-refresh-response'
  | 'tokens-missing';

/** `reason`은 클라이언트의 결정 경로, `serverErrorCode`는 서버의 판정이라 섞지 않는다 */
export interface SessionExpiredDetails {
  reason: SessionExpiredReason;
  /** `refresh-rejected`일 때만 존재 (`SESSION_0704` 토큰 재사용 vs `SESSION_0702` 만료) */
  serverErrorCode?: ErrorCodeType;
}

/** 비자발적 로그아웃은 전부 조사 대상이라 어느 사유도 `info`가 아니다 (`no-refresh-token`을 낮춘 탓에 대량 로그아웃이 노이즈로 위장됐다) */
export const SESSION_EXPIRED_SEVERITY = {
  'refresh-rejected': 'warning',
  'tokens-missing': 'warning',
  'invalid-refresh-response': 'error',
} as const satisfies Record<SessionExpiredReason, Severity>;
