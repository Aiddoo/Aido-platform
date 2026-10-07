import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationDedupPort } from "../../ports/delivery/notification-dedup.port.js";
import {
  type FindAlreadyNotifiedUserIdsQuery,
  type NotificationHistoryReaderPort,
} from "../../ports/delivery/notification-history.reader.port.js";

/**
 * 이미 알림을 받은 사용자 ID 목록 조회 유스케이스 (배치)
 *
 * Sentinel 기반 atomic cold-start 감지:
 * - 단일 SMISMEMBER 호출로 sentinel + userIds를 동시에 확인
 * - Sentinel 있음 = warm → Redis 결과 신뢰
 * - Sentinel 없음 = cold start → DB fallback + warm-up
 */
interface NotificationHistoryReaderDependencies {
  readonly notificationDedup: Pick<NotificationDedupPort, "readKnownRecipients" | "warmRecipients">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "findAlreadyNotifiedUserIds"
  >;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

export class NotificationHistoryReader {
  readonly #dependencies: NotificationHistoryReaderDependencies;

  constructor(dependencies: NotificationHistoryReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findAlreadyNotifiedUserIds(params: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const knownRecipients = await this.#dependencies.notificationDedup.readKnownRecipients(
      params.type,
      params.notificationDate,
      params.userIds,
    );
    if (knownRecipients !== null) {
      return knownRecipients;
    }

    // Cold start: DB fallback + Redis warm-up
    const fromDb =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds(params);

    this.#dependencies.notificationDedup
      .warmRecipients(params.type, params.notificationDate, [...fromDb])
      .catch(() => {
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.NOTIFICATION_HISTORY_WARM_UP_FAILED,
          errorType: "cache-warm-up",
        });
      });

    return fromDb;
  }
}
