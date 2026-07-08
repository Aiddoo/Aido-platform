import type { ErrorCodeType } from '@aido/errors';
import type { Severity } from '@src/core/ports/severity';

/**
 * 클라이언트가 세션을 종료한 **결정 경로**.
 *
 * 세션의 유효성은 서버가 진실의 원천이다 — 클라이언트는 스스로 세션이 끝났다고 판단하지 않는다.
 * 그러나 "왜 종료했는가"에는 서버가 원리적으로 알 수 없는 경우가 있다:
 *
 * - `tokens-missing`: 요청이 나가지도 못했다. 로컬 토큰이 사라졌다(Android KeyStore 무효화 등).
 * - `invalid-refresh-response`: 서버는 200을 주고 성공했다고 믿는다. 클라가 새 토큰을 못 읽었다.
 * - `refresh-rejected`: 서버가 거부했다. **이 경우에만** 서버의 판정(`serverErrorCode`)이 존재하며,
 *   그것이 진짜 사유다. HTTP 상태(401)는 전송 계층 사정이므로 이름에 넣지 않는다.
 */
export type SessionExpiredReason =
  | 'refresh-rejected'
  | 'invalid-refresh-response'
  | 'tokens-missing';

/** 갱신기가 서버 응답에 근거해 "세션 무효"로 판정할 수 있는 사유. */
export type RefreshRejectionReason = Exclude<SessionExpiredReason, 'tokens-missing'>;

/**
 * 세션 종료 사실 + 서버가 아는 경우의 서버 판정.
 *
 * 두 축을 섞지 않는다: `reason`은 클라이언트의 결정 경로, `serverErrorCode`는 서버의 판정.
 */
export interface SessionExpiredDetails {
  reason: SessionExpiredReason;
  /** `refresh-rejected`일 때만 존재. 예: `SESSION_0704`(토큰 재사용) vs `SESSION_0702`(만료). */
  serverErrorCode?: ErrorCodeType;
}

/**
 * 앱이 명시적으로 발행하는 관측 이벤트 카탈로그.
 *
 * discriminated union으로 이벤트명과 payload를 강제한다. 새 이벤트는 이 유니온에
 * 추가하는 방식으로만 늘린다(자유 문자열 이벤트 금지).
 */
export type TelemetryEvent = {
  name: 'session_expired';
  severity: Severity;
  data: { reason: SessionExpiredReason };
};

/**
 * reason → severity 매핑.
 *
 * 어느 사유도 `info`가 아니다. 비자발적 로그아웃은 전부 조사 대상이다 —
 * `no-refresh-token`을 `info`로 낮춰 두었던 탓에 v1.4.0 대량 로그아웃이
 * 저우선순위 노이즈로 위장됐다.
 */
export const sessionExpiredSeverity: Record<SessionExpiredReason, Severity> = {
  'refresh-rejected': 'warning',
  'tokens-missing': 'warning',
  'invalid-refresh-response': 'error',
};
