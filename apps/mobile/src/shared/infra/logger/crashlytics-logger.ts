import crashlytics from '@react-native-firebase/crashlytics';
import type { LogContext, Logger } from '@src/core/ports/logger';

export const createCrashlyticsLogger = (): Logger => {
  const crashlyticsInstance = crashlytics();

  const formatMessage = (level: string, message: string, context?: LogContext): string => {
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${level}] ${message}${contextStr}`;
  };

  return {
    debug(_message: string, _context?: LogContext): void {
      // debug 로그는 Crashlytics에 전송하지 않음
    },
    info(message: string, context?: LogContext): void {
      crashlyticsInstance.log(formatMessage('INFO', message, context));
    },
    warn(message: string, context?: LogContext): void {
      crashlyticsInstance.log(formatMessage('WARN', message, context));
    },
    error(message: string, error?: Error, context?: LogContext): void {
      crashlyticsInstance.log(formatMessage('ERROR', message, context));
      if (error) {
        crashlyticsInstance.recordError(error);
      }
    },
  };
};
