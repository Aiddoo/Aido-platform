import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { MINUTE_MS } from "#api/shared/domain/time/time-units";

import type { PurgePushDeliveryHistoryUseCase } from "../../../push-dispatches/notification-push-dispatches.public.js";
import { NOTIFICATION_RETENTION_DAYS } from "../../domain/notification-retention.constants.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import type { NotificationRepositoryPort } from "../ports/notification.repository.port.js";

// 문장 하나가 FK cascade까지 짧게 끝나는 크기다(docs/scaling.md 묶음 단위)
const PURGE_BATCH_SIZE = 500;
// 작은 RDS의 메모리·I/O를 오래 잡지 않도록 하루 실행을 끊고 남은 행은 다음 날 이어 지운다
const PURGE_TIME_BUDGET_MS = 2 * MINUTE_MS;

interface PurgeNotificationHistoryDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "deleteCreatedBefore">;
  readonly purgePushDeliveryHistory: Pick<PurgePushDeliveryHistoryUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 발송 기록을 먼저, 보관 기간이 지난 알림을 그다음에 묶음으로 지운다 */
export class PurgeNotificationHistoryUseCase {
  readonly #dependencies: PurgeNotificationHistoryDependencies;

  constructor(dependencies: PurgeNotificationHistoryDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const { clock, purgePushDeliveryHistory, logger } = this.#dependencies;
    const now = clock.now();
    const deadline = now.add({ milliseconds: PURGE_TIME_BUDGET_MS });
    const push = await purgePushDeliveryHistory.execute({
      deadline,
      batchSize: PURGE_BATCH_SIZE,
    });
    // UTC 일수라 일광 절약 없이 24시간 단위다
    const createdBefore = now.subtract({ hours: 24 * NOTIFICATION_RETENTION_DAYS });
    const notifications = push.completed
      ? await this.#purgeNotifications(createdBefore, deadline)
      : { deletedCount: 0, completed: false };

    logger.log({
      event: NotificationLogEvent.NOTIFICATION_HISTORY_PURGED,
      deletedNotifications: notifications.deletedCount,
      completed: notifications.completed,
    });
  }

  async #purgeNotifications(
    createdBefore: Temporal.Instant,
    deadline: Temporal.Instant,
  ): Promise<{ readonly deletedCount: number; readonly completed: boolean }> {
    let deletedCount = 0;
    let createdFrom: Temporal.Instant | null = null;
    while (Temporal.Instant.compare(this.#dependencies.clock.now(), deadline) < 0) {
      const batch = await this.#dependencies.notificationRepository.deleteCreatedBefore({
        createdBefore,
        createdFrom,
        limit: PURGE_BATCH_SIZE,
      });
      deletedCount += batch.deletedCount;
      if (batch.deletedCount < PURGE_BATCH_SIZE || batch.lastCreatedAt == null) {
        return { deletedCount, completed: true };
      }
      createdFrom = batch.lastCreatedAt;
    }
    return { deletedCount, completed: false };
  }
}
