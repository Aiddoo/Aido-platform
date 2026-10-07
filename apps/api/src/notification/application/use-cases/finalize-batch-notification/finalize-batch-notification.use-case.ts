import { Inject, Injectable, Logger } from "@nestjs/common";
import { forEachAsync, uniq } from "es-toolkit";

import {
  NOTIFICATION_CACHE,
  type NotificationCachePort,
} from "../../ports/notification-cache.port.js";
import {
  NOTIFICATION_DEDUP,
  type NotificationDedupPort,
} from "../../ports/notification-dedup.port.js";
import type { PersistedBatchNotificationResult } from "../../types/push-delivery.types.js";

const CACHE_INVALIDATION_CONCURRENCY = 5;

/** 커밋된 배치 알림의 cache와 날짜 dedup 후처리를 관찰 가능한 방식으로 정리한다. */
@Injectable()
export class FinalizeBatchNotificationUseCase {
  readonly #logger = new Logger(FinalizeBatchNotificationUseCase.name);

  constructor(
    @Inject(NOTIFICATION_CACHE)
    private readonly cache: NotificationCachePort,
    @Inject(NOTIFICATION_DEDUP)
    private readonly notificationDedup: NotificationDedupPort,
  ) {}

  async execute(input: PersistedBatchNotificationResult): Promise<{ count: number }> {
    if (input.count === 0) {
      return { count: 0 };
    }

    const uniqueUserIds = uniq(input.sourceData.map((data) => data.userId));
    await forEachAsync(
      uniqueUserIds,
      async (userId) => {
        try {
          await this.cache.invalidateUnreadCount(userId);
        } catch (error) {
          this.#logger.warn(`알림 커밋 후 미읽음 캐시 정리 실패: userId=${userId}, ${error}`);
        }
      },
      { concurrency: CACHE_INVALIDATION_CONCURRENCY },
    );

    try {
      await this.notificationDedup.recordNotifiedUsers(
        input.sourceData.flatMap((data) =>
          data.notificationDate
            ? [{ userId: data.userId, type: data.type, notificationDate: data.notificationDate }]
            : [],
        ),
      );
    } catch (error) {
      this.#logger.warn(`알림 커밋 후 날짜 중복 기록 실패: ${error}`);
    }

    return { count: input.count };
  }
}
