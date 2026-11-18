import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationLogEvent } from "../notifications.log-events.js";
import { type NotificationCachePort } from "../ports/notification-cache.port.js";

export interface InvalidateRecipientUnreadCountsCommand {
  readonly userIds: readonly UserId[];
}

interface InvalidateRecipientUnreadCountsDependencies {
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/** 끝난 계정 삭제를 캐시 장애 때문에 실패로 보고하지 않도록 받은 사람마다 best-effort로 정리한다 */
export class InvalidateRecipientUnreadCountsUseCase {
  readonly #dependencies: InvalidateRecipientUnreadCountsDependencies;

  constructor(dependencies: InvalidateRecipientUnreadCountsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: InvalidateRecipientUnreadCountsCommand): Promise<void> {
    const { cache, logger } = this.#dependencies;
    const settlements = await Promise.allSettled(
      command.userIds.map((userId) => cache.invalidateUnreadCount(userId)),
    );
    for (const [index, settlement] of settlements.entries()) {
      if (settlement.status === "rejected") {
        logger.warn({
          event: NotificationLogEvent.NOTIFICATION_ACCOUNT_CLEANUP_CACHE_SETTLE_FAILED,
          userId: command.userIds[index]?.value,
          errorType: "cache-invalidation",
        });
      }
    }
  }
}
