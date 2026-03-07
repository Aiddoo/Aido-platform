import crashlytics from '@react-native-firebase/crashlytics';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';

export const createCrashlyticsErrorReporter = (logger: Logger): ErrorReporter => {
  const crashlyticsInstance = crashlytics();

  const toStringAttributes = (context: ErrorReporterContext): Record<string, string> => {
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) attrs[key] = String(value);
    }
    return attrs;
  };

  return {
    captureException(error: Error, context?: ErrorReporterContext): void {
      try {
        if (context) {
          crashlyticsInstance.setAttributes(toStringAttributes(context));
        }
        crashlyticsInstance.recordError(error);
      } catch (e) {
        logger.warn('[CrashlyticsErrorReporter] captureException failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    captureMessage(message: string, context?: ErrorReporterContext): void {
      try {
        crashlyticsInstance.log(message);
        if (context) {
          crashlyticsInstance.setAttributes(toStringAttributes(context));
        }
      } catch (e) {
        logger.warn('[CrashlyticsErrorReporter] captureMessage failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    async setUserId(userId: string | null): Promise<void> {
      await crashlyticsInstance.setUserId(userId ?? '');
    },
  };
};
