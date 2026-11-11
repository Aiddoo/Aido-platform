import { forEachAsync, uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type NotificationDedupPort } from "../ports/notification-dedup.port.js";
import type { PersistedBatchNotificationResult } from "../read-models/push-delivery.read-model.js";

const CACHE_INVALIDATION_CONCURRENCY = 5;

/** 커밋된 배치 알림의 cache와 날짜 dedup 후처리를 관찰 가능한 방식으로 정리한다. */
interface FinalizeBatchNotificationDependencies {
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly notificationDedup: Pick<NotificationDedupPort, "recordNotifiedUsers">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class FinalizeBatchNotificationUseCase {
  readonly #dependencies: FinalizeBatchNotificationDependencies;

  constructor(dependencies: FinalizeBatchNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: PersistedBatchNotificationResult): Promise<{ count: number }> {
    if (input.count === 0) {
      return { count: 0 };
    }

    const uniqueUserIds = uniq(input.sourceData.map((data) => data.userId));
    await forEachAsync(
      uniqueUserIds,
      async (userId) => {
        try {
          await this.#dependencies.cache.invalidateUnreadCount(UserId.reconstitute(userId));
        } catch {
          this.#dependencies.logger.warn({
            event: NotificationDeliveryLogEvent.FINALIZE_BATCH_NOTIFICATION_UNREAD_CACHE_FAILED,
            userId,
            errorType: "cache-invalidation",
          });
        }
      },
      { concurrency: CACHE_INVALIDATION_CONCURRENCY },
    );

    try {
      await this.#dependencies.notificationDedup.recordNotifiedUsers(
        input.sourceData.flatMap((data) =>
          data.notificationDate
            ? [{ userId: data.userId, type: data.type, notificationDate: data.notificationDate }]
            : [],
        ),
      );
    } catch {
      this.#dependencies.logger.warn({
        event: NotificationDeliveryLogEvent.FINALIZE_BATCH_NOTIFICATION_DEDUP_RECORD_FAILED,
        count: input.count,
        errorType: "dedup-recording",
      });
    }

    return { count: input.count };
  }
}
