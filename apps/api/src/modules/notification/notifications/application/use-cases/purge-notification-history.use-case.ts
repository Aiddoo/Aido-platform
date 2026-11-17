import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { DAY_MS, MINUTE_MS } from "#api/shared/domain/time/time-units";

import type { PurgePushDeliveryHistoryUseCase } from "../../../push-dispatches/notification-push-dispatches.public.js";
import { NOTIFICATION_RETENTION_DAYS } from "../../domain/notification-retention.constants.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import type { NotificationCachePort } from "../ports/notification-cache.port.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

// 문장 하나가 FK cascade까지 짧게 끝나는 크기다(docs/scaling.md 묶음 단위)
const PURGE_BATCH_SIZE = 500;
// 작은 RDS의 메모리·I/O를 오래 잡지 않도록 하루 실행을 끊고 남은 행은 다음 날 이어 지운다
const PURGE_TIME_BUDGET_MS = 2 * MINUTE_MS;

interface PurgeNotificationHistoryDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "deleteCreatedBefore">;
  readonly purgePushDeliveryHistory: Pick<PurgePushDeliveryHistoryUseCase, "execute">;
  readonly notificationCache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

interface PurgeNotificationHistoryResult {
  readonly deletedNotifications: number;
  readonly completed: boolean;
}

/** 발송 기록을 먼저, 보관 기간이 지난 알림을 그다음에 묶음으로 지운다 */
export class PurgeNotificationHistoryUseCase {
  readonly #dependencies: PurgeNotificationHistoryDependencies;

  constructor(dependencies: PurgeNotificationHistoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<PurgeNotificationHistoryResult> {
    const { clock, purgePushDeliveryHistory, logger } = this.#dependencies;
    const now = clock.now();
    const deadline = now.add({ milliseconds: PURGE_TIME_BUDGET_MS });
    const push = await purgePushDeliveryHistory.execute({
      deadline,
      batchSize: PURGE_BATCH_SIZE,
    });
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const createdBefore = now.subtract({ milliseconds: NOTIFICATION_RETENTION_DAYS * DAY_MS });
    const notifications = push.completed
      ? await this.#purgeNotifications(createdBefore, deadline)
      : { deletedNotifications: 0, completed: false };

    logger.log({ event: NotificationLogEvent.NOTIFICATION_HISTORY_PURGED, ...notifications });
    return notifications;
  }

  async #purgeNotifications(
    createdBefore: Temporal.Instant,
    deadline: Temporal.Instant,
  ): Promise<PurgeNotificationHistoryResult> {
    let deletedNotifications = 0;
    let createdFrom: Temporal.Instant | null = null;
    while (Temporal.Instant.compare(this.#dependencies.clock.now(), deadline) < 0) {
      const batch = await this.#dependencies.notificationRepository.deleteCreatedBefore({
        createdBefore,
        createdFrom,
        limit: PURGE_BATCH_SIZE,
      });
      deletedNotifications += batch.deletedCount;
      // 문장마다 커밋되므로 바로 비운다. 안 읽은 알림이 빠진 사람의 수만 바뀐다
      await this.#invalidateUnreadCounts(batch.unreadOwnerIds);
      if (batch.deletedCount < PURGE_BATCH_SIZE || batch.lastCreatedAt == null) {
        return { deletedNotifications, completed: true };
      }
      createdFrom = batch.lastCreatedAt;
    }
    return { deletedNotifications, completed: false };
  }

  async #invalidateUnreadCounts(ownerIds: readonly UserId[]): Promise<void> {
    const settlements = await Promise.allSettled(
      ownerIds.map((ownerId) =>
        this.#dependencies.notificationCache.invalidateUnreadCount(ownerId),
      ),
    );
    const failedCount = settlements.filter(({ status }) => status === "rejected").length;
    if (failedCount > 0) {
      this.#dependencies.logger.warn({
        event: NotificationLogEvent.NOTIFICATION_HISTORY_PURGE_UNREAD_CACHE_FAILED,
        failedCount,
        errorType: "cache-invalidation",
      });
    }
  }
}
