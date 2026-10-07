import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { subtractMilliseconds } from "#api/shared/domain/date/utils/arithmetic";

import type { NotificationRecord } from "../../../domain/records/delivery/notification.record.js";
import {
  buildDedupContextFields,
  buildDedupKey,
  resolveDedupStrategy,
} from "../../../domain/services/delivery/notification-dedup.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { type NotificationDedupLockPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";
import type { SendNotification } from "./send-notification.use-case.js";

/**
 * 중복 방지가 적용된 알림 생성 및 푸시 발송 유스케이스.
 *
 * Race Condition 방지: ILockProvider 기반 잠금으로
 * 같은 (userId, type, contextKeys) 조합의 동시 요청을 직렬화한다.
 *
 * @returns 생성된 Notification 또는 null (중복 스킵 / 잠금 대기 스킵)
 */
interface SendNotificationWithDedupDependencies {
  readonly sendNotification: SendNotification;
  readonly dedupLock: NotificationDedupLockPort;
  readonly notificationHistoryReader: NotificationHistoryReaderPort;
  readonly logger: ApplicationLogger;
}

export class SendNotificationWithDedup {
  readonly #dependencies: SendNotificationWithDedupDependencies;

  constructor(dependencies: SendNotificationWithDedupDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<NotificationRecord | null> {
    const strategy = resolveDedupStrategy(data.type);

    if (!strategy) {
      return this.#dependencies.sendNotification.execute(data);
    }

    const dedupKey = buildDedupKey(data, strategy);
    const release = await this.#dependencies.dedupLock.acquire(dedupKey);

    if (!release) {
      this.#dependencies.logger.debug(
        `Notification dedup: lock busy for ${data.type}, userId=${data.userId}`,
      );
      return null;
    }

    try {
      const since = subtractMilliseconds(strategy.windowMs);
      const contextFields = buildDedupContextFields(data, strategy);
      const params = {
        userId: data.userId,
        type: data.type,
        since,
        ...contextFields,
      };

      const exists =
        await this.#dependencies.notificationHistoryReader.existsRecentNotification(params);
      if (exists) {
        this.#dependencies.logger.debug(
          `Notification dedup: skipped ${data.type} for userId=${data.userId}`,
        );
        return null;
      }

      return await this.#dependencies.sendNotification.execute(data);
    } finally {
      await release();
    }
  }
}
