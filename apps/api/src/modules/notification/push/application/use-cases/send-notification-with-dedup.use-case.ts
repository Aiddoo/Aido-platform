import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { type NotificationHistoryReaderPort } from "../../../inbox/application/ports/notification-history.reader.port.js";
import type { InboxNotification } from "../../../inbox/application/read-models/inbox-notification.read-model.js";
import {
  buildDedupContextFields,
  buildDedupKey,
  resolveDedupStrategy,
} from "../../domain/notification-dedup.domain-service.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { PushLockKeys } from "../push.lock-keys.js";
import type { SendNotificationUseCase } from "./send-notification.use-case.js";

interface SendNotificationWithDedupDependencies {
  readonly sendNotification: Pick<SendNotificationUseCase, "execute">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly mutationLock: Pick<MutationLockPort, "acquire">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "existsRecentNotification"
  >;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "debug">;
}

/** 같은 (userId, type, 컨텍스트)의 알림이 창 안에 이미 있으면 null을 돌려주고 보내지 않는다. */
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

    return this.#dependencies.unitOfWork.run(async () => {
      // 같은 key의 동시 발송은 앞선 트랜잭션이 커밋한 알림을 보고 건너뛰도록 조회 전에 줄을 세운다
      await this.#dependencies.mutationLock.acquire([
        PushLockKeys.recentNotification(buildDedupKey(data, strategy)),
      ]);

      const exists = await this.#dependencies.notificationHistoryReader.existsRecentNotification({
        userId: data.userId,
        type: data.type,
        since: this.#dependencies.clock.now().subtract({ milliseconds: strategy.windowMs }),
        ...buildDedupContextFields(data, strategy),
      });
      if (exists) {
        this.#dependencies.logger.debug({
          event: NotificationDeliveryLogEvent.SEND_NOTIFICATION_WITH_DEDUP_DUPLICATE_SKIPPED,
          type: data.type,
          userId: data.userId,
        });
        return null;
      }

      return this.#dependencies.sendNotification.execute(data);
    });
  }
}
