import type { Logger } from '@src/core/ports/logger';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

/**
 * RevenueCat SDK 라이프사이클 관리
 *
 * SDK 초기화, 사용자 동기화만 담당.
 * RevenueCatProvider에서만 사용한다.
 */
export class RevenueCatSdkManager {
  readonly #logger: Logger;
  #configured = false;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  configure = (apiKey: string): void => {
    if (!apiKey) {
      this.#logger.warn('[RevenueCatSdkManager] API key is empty, skipping configure');
      return;
    }

    try {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.WARN);
      }
      Purchases.configure({ apiKey });
      this.#configured = true;
    } catch (error) {
      this.#logger.warn('[RevenueCatSdkManager] Configure failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  logIn = async (userId: string): Promise<void> => {
    if (!this.#configured) {
      return;
    }

    try {
      await Purchases.logIn(userId);
    } catch (error) {
      this.#logger.warn('[RevenueCatSdkManager] logIn failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      this.#logger.warn('[RevenueCatSdkManager] logOut failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  isConfigured = (): boolean => {
    return this.#configured;
  };
}
