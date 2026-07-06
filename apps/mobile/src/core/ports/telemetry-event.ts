import type { Severity } from '@src/core/ports/severity';

/**
 * 세션이 종료(로그아웃)로 확정된 사유.
 *
 * `token-refresher`가 세션 만료를 확정하는 세 경로와 1:1 대응한다.
 * 문자열이 아니라 union으로 두어 인프라(방출)→프레젠테이션(리포팅) 전 구간 타입을 보장한다.
 */
export type SessionExpiredReason =
  | 'no-refresh-token'
  | 'invalid-refresh-response'
  | 'refresh-rejected-401';

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

/** reason → severity 매핑. `no-refresh-token`은 예상 범주(info)로 노이즈를 낮춘다. */
export const sessionExpiredSeverity: Record<SessionExpiredReason, Severity> = {
  'no-refresh-token': 'info',
  'refresh-rejected-401': 'warning',
  'invalid-refresh-response': 'error',
};
