import crashlytics from '@react-native-firebase/crashlytics';

export const initCrashlytics = (enableCollection: boolean): void => {
  crashlytics()
    .setCrashlyticsCollectionEnabled(enableCollection)
    .catch((e) => {
      if (__DEV__) console.warn('[Crashlytics] init failed:', e);
    });
};
