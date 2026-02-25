import Purchases, { LOG_LEVEL } from 'react-native-purchases';

/**
 * RevenueCat SDK 라이프사이클 관리
 *
 * SDK 초기화, 사용자 동기화만 담당.
 * RevenueCatProvider에서만 사용한다.
 */
export class RevenueCatSdkManager {
  #configured = false;

  configure = (apiKey: string): void => {
    if (!apiKey) {
      if (__DEV__) {
        console.warn('[RevenueCatSdkManager] API key is empty, skipping configure');
      }
      return;
    }

    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }
      Purchases.configure({ apiKey });
      this.#configured = true;
    } catch (error) {
      if (__DEV__)
        console.warn(
          '[RevenueCatSdkManager] configure failed (native module not available?):',
          error,
        );
    }
  };

  logIn = async (userId: string): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      await Purchases.logIn(userId);
    } catch (error) {
      if (__DEV__) {
        console.warn('[RevenueCatSdkManager] logIn failed:', error);
      }
    }
  };

  logOut = async (): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      const isAnonymous = await Purchases.isAnonymous();
      if (isAnonymous) {
        return;
      }

      await Purchases.logOut();
    } catch (error) {
      if (__DEV__) {
        console.warn('[RevenueCatSdkManager] logOut failed:', error);
      }
    }
  };

  isConfigured = (): boolean => {
    return this.#configured;
  };
}
