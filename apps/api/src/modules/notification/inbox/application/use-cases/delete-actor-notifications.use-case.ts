import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationDeliveryLogEvent } from "../../../push/application/notification-delivery.log-events.js";
import { type NotificationCachePort } from "../ports/notification-cache.port.js";
import { type NotificationRepositoryPort } from "../ports/notification.repository.port.js";

/** auth purge가 소비하는 알림 bounded context의 개인정보 정리 capability입니다. */
export interface NotificationAccountCleanupResult {
  affectedUserIds: string[];
}

interface NotificationAccountCleanupDependencies {
  readonly repository: Pick<NotificationRepositoryPort, "deleteNotificationsByActorId">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class DeleteActorNotificationsUseCase {
  readonly #dependencies: NotificationAccountCleanupDependencies;

  constructor(dependencies: NotificationAccountCleanupDependencies) {
    this.#dependencies = dependencies;
  }

  async cleanupInTransaction(userId: string): Promise<NotificationAccountCleanupResult> {
    const result = await this.#dependencies.repository.deleteNotificationsByActorId(
      UserId.reconstitute(userId),
    );
    return { affectedUserIds: result.affectedUserIds };
  }

  async settleAfterCommit(result: NotificationAccountCleanupResult): Promise<void> {
    const settlements = await Promise.allSettled(
      result.affectedUserIds.map((userId) =>
        this.#dependencies.cache.invalidateUnreadCount(UserId.reconstitute(userId)),
      ),
    );
    for (const [index, settlement] of settlements.entries()) {
      if (settlement.status === "rejected") {
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.NOTIFICATION_ACCOUNT_CLEANUP_CACHE_SETTLE_FAILED,
          userId: result.affectedUserIds[index],
          errorType: "cache-invalidation",
        });
      }
    }
  }
}
