import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";

/** auth purge가 소비하는 알림 bounded context의 개인정보 정리 capability입니다. */
export interface NotificationAccountCleanupResult {
  affectedUserIds: string[];
}

interface NotificationAccountCleanupDependencies {
  readonly repository: NotificationRepositoryPort;
  readonly cache: NotificationCachePort;
  readonly logger: ApplicationLogger;
}

export class NotificationAccountCleanup {
  readonly #dependencies: NotificationAccountCleanupDependencies;

  constructor(dependencies: NotificationAccountCleanupDependencies) {
    this.#dependencies = dependencies;
  }

  async cleanupInTransaction(userId: string): Promise<NotificationAccountCleanupResult> {
    const result = await this.#dependencies.repository.deleteNotificationsByActorId(userId);
    return { affectedUserIds: result.affectedUserIds };
  }

  async settleAfterCommit(result: NotificationAccountCleanupResult): Promise<void> {
    const settlements = await Promise.allSettled(
      result.affectedUserIds.map((userId) =>
        this.#dependencies.cache.invalidateUnreadCount(userId),
      ),
    );
    for (const [index, settlement] of settlements.entries()) {
      if (settlement.status === "rejected") {
        this.#dependencies.logger.warn(
          `계정 정리 후 알림 캐시를 무효화하지 못했습니다: userId=${result.affectedUserIds[index]}`,
        );
      }
    }
  }
}
