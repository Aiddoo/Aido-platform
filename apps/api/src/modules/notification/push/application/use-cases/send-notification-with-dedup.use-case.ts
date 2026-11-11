import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { type NotificationHistoryReaderPort } from "../../../inbox/application/ports/notification-history.reader.port.js";
import type { InboxNotification } from "../../../inbox/application/read-models/inbox-notification.read-model.js";
import {
  buildDedupContextFields,
  buildDedupKey,
  resolveDedupStrategy,
} from "../../domain/notification-dedup.domain-service.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type NotificationDedupLockPort } from "../ports/notification-dedup.port.js";
import type { SendNotificationUseCase } from "./send-notification.use-case.js";

/**
 * 중복 방지가 적용된 알림 생성 및 푸시 발송 유스케이스.
 *
 * Race Condition 방지: LockProviderPort 기반 잠금으로
 * 같은 (userId, type, contextKeys) 조합의 동시 요청을 직렬화한다.
 *
 * @returns 생성된 Notification 또는 null (중복 스킵 / 잠금 대기 스킵)
 */
interface SendNotificationWithDedupDependencies {
  readonly sendNotification: Pick<SendNotificationUseCase, "execute">;
  readonly dedupLock: Pick<NotificationDedupLockPort, "acquire">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "existsRecentNotification"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

export class SendNotificationWithDedupUseCase {
  readonly #dependencies: SendNotificationWithDedupDependencies;

  constructor(dependencies: SendNotificationWithDedupDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<InboxNotification | null> {
    const strategy = resolveDedupStrategy(data.type);

    if (strategy == null) {
      return this.#dependencies.sendNotification.execute(data);
    }

    const dedupKey = buildDedupKey(data, strategy);
    const release = await this.#dependencies.dedupLock.acquire(dedupKey);

    if (release == null) {
      this.#dependencies.logger.debug({
        event: NotificationDeliveryLogEvent.SEND_NOTIFICATION_WITH_DEDUP_LOCK_BUSY,
        type: data.type,
        userId: data.userId,
      });
      return null;
    }

    try {
      const since = this.#dependencies.clock.now().subtract({ milliseconds: strategy.windowMs });
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
        this.#dependencies.logger.debug({
          event: NotificationDeliveryLogEvent.SEND_NOTIFICATION_WITH_DEDUP_DUPLICATE_SKIPPED,
          type: data.type,
          userId: data.userId,
        });
        return null;
      }

      return await this.#dependencies.sendNotification.execute(data);
    } finally {
      await release();
    }
  }
}
