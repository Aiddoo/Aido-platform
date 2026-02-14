import crashlytics from '@react-native-firebase/crashlytics';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

export const createCrashlyticsErrorReporter = (): ErrorReporter => {
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
        if (__DEV__) console.warn('[CrashlyticsErrorReporter] captureException failed:', e);
      }
    },
    captureMessage(message: string, context?: ErrorReporterContext): void {
      try {
        crashlyticsInstance.log(message);
        if (context) {
          crashlyticsInstance.setAttributes(toStringAttributes(context));
        }
      } catch (e) {
        if (__DEV__) console.warn('[CrashlyticsErrorReporter] captureMessage failed:', e);
      }
    },
    async setUserId(userId: string | null): Promise<void> {
      await crashlyticsInstance.setUserId(userId ?? '');
    },
  };
};
