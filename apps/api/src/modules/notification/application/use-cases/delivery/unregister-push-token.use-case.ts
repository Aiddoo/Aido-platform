import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import {
  PushTokenNotFoundError,
  type PushTokenRepositoryPort,
} from "../../ports/delivery/push-token.repository.port.js";

/**
 * 푸시 토큰 해제 유스케이스.
 *
 * deviceId가 있으면 해당 기기 토큰만, 없으면 사용자의 모든 토큰을 해제한다.
 */
interface UnregisterPushTokenDependencies {
  readonly pushTokenRepository: PushTokenRepositoryPort;
  readonly cache: NotificationCachePort;
  readonly logger: ApplicationLogger;
}

export class UnregisterPushToken {
  readonly #dependencies: UnregisterPushTokenDependencies;

  constructor(dependencies: UnregisterPushTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, deviceId?: string): Promise<void> {
    if (deviceId) {
      await this.#unregisterOne(userId, deviceId);
    } else {
      await this.#unregisterAll(userId);
    }
  }

  async #unregisterOne(userId: string, deviceId: string): Promise<void> {
    try {
      await this.#dependencies.pushTokenRepository.deletePushToken(userId, deviceId);
      await this.#dependencies.cache.invalidatePushTokens(userId);
      this.#dependencies.logger.log(
        `Push token unregistered: userId=${userId}, deviceId=${deviceId}`,
      );
    } catch (error) {
      if (error instanceof PushTokenNotFoundError) {
        this.#dependencies.logger.warn(
          `Push token not found: userId=${userId}, deviceId=${deviceId}`,
        );
        return;
      }
      throw error;
    }
  }

  async #unregisterAll(userId: string): Promise<void> {
    const result = await this.#dependencies.pushTokenRepository.deleteAllPushTokensByUser(userId);
    await this.#dependencies.cache.invalidatePushTokens(userId);
    this.#dependencies.logger.log(
      `All push tokens unregistered: userId=${userId}, count=${result.count}`,
    );
  }
}
