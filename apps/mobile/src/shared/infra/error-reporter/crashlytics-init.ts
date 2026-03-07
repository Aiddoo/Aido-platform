import crashlytics from '@react-native-firebase/crashlytics';
import type { Logger } from '@src/core/ports/logger';

export const initCrashlytics = (enableCollection: boolean, logger: Logger): void => {
  crashlytics()
    .setCrashlyticsCollectionEnabled(enableCollection)
    .catch((e) => {
      logger.warn('[Crashlytics] Init failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    });
};
