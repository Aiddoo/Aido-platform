import type { TelemetryData } from '@src/core/observability/telemetry-keys';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = TelemetryData;
/** debug는 개발 콘솔에만 찍고 Sentry로 보내지 않아 키를 묶지 않는다 */
export type DebugLogContext = Record<string, unknown>;

export interface AppLogger {
  debug(message: string, context?: DebugLogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}
