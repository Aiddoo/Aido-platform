import type { LogLevel } from '@src/core/ports/logger';

/**
 * 관측(observability) 이벤트의 심각도.
 *
 * 벤더 중립 도메인 타입. 어댑터가 각 벤더의 레벨로 매핑한다
 * (Sentry `SeverityLevel`, Logger `LogLevel` 등). 도메인 코드는 이 타입만 사용한다.
 */
export type Severity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Severity → Logger `LogLevel` 매핑.
 *
 * `Record<Severity, LogLevel>`로 선언해 Severity에 항목이 추가되면
 * 컴파일 타임에 매핑 누락을 강제한다(exhaustiveness).
 */
export const severityToLogLevel: Record<Severity, LogLevel> = {
  debug: 'debug',
  info: 'info',
  warning: 'warn',
  error: 'error',
  fatal: 'error',
};
