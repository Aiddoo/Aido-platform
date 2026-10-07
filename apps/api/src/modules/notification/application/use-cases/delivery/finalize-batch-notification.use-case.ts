import { forEachAsync, uniq } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import { type NotificationDedupPort } from "../../ports/delivery/notification-dedup.port.js";
import type { PersistedBatchNotificationResult } from "../../types/delivery/push-delivery.types.js";

const CACHE_INVALIDATION_CONCURRENCY = 5;

/** 커밋된 배치 알림의 cache와 날짜 dedup 후처리를 관찰 가능한 방식으로 정리한다. */
interface FinalizeBatchNotificationDependencies {
  readonly cache: NotificationCachePort;
  readonly notificationDedup: NotificationDedupPort;
  readonly logger: ApplicationLogger;
}

export class FinalizeBatchNotification {
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
          await this.#dependencies.cache.invalidateUnreadCount(userId);
        } catch (error) {
          this.#dependencies.logger.warn(
            `알림 커밋 후 미읽음 캐시 정리 실패: userId=${userId}, ${error}`,
          );
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
    } catch (error) {
      this.#dependencies.logger.warn(`알림 커밋 후 날짜 중복 기록 실패: ${error}`);
    }

    return { count: input.count };
  }
}
