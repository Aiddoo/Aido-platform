import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
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
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    "deleteAllPushTokensByUser" | "deletePushToken"
  >;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
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
      this.#dependencies.logger.log({
        event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_TOKEN_UNREGISTERED,
        userId,
      });
    } catch (error) {
      if (error instanceof PushTokenNotFoundError) {
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_TOKEN_NOT_FOUND,
          userId,
        });
        return;
      }
      throw error;
    }
  }

  async #unregisterAll(userId: string): Promise<void> {
    const result = await this.#dependencies.pushTokenRepository.deleteAllPushTokensByUser(userId);
    await this.#dependencies.cache.invalidatePushTokens(userId);
    this.#dependencies.logger.log({
      event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_TOKEN_ALL_UNREGISTERED,
      userId,
      count: result.count,
    });
  }
}
