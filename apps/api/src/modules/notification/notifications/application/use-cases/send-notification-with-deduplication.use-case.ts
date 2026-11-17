import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import {
  buildDeduplicationContextFields,
  buildDeduplicationKey,
  resolveDeduplicationStrategy,
} from "../../domain/notification-deduplication.domain-service.js";
import { NotificationLockKeys } from "../notifications.lock-keys.js";
import { NotificationLogEvent } from "../notifications.log-events.js";
import { type NotificationHistoryReaderPort } from "../ports/notification-history.reader.port.js";
import type { InboxNotificationReadModel } from "../read-models/inbox-notification.read-model.js";
import type { SendNotificationUseCase } from "./send-notification.use-case.js";

interface SendNotificationWithDeduplicationDependencies {
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
export class SendNotificationWithDeduplicationUseCase {
  readonly #dependencies: SendNotificationWithDeduplicationDependencies;

  constructor(dependencies: SendNotificationWithDeduplicationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<InboxNotificationReadModel | null> {
    const strategy = resolveDeduplicationStrategy(data.type);

    if (strategy == null) {
      return this.#dependencies.sendNotification.execute(data);
    }

    return this.#dependencies.unitOfWork.run(async () => {
      // 같은 key의 동시 발송은 앞선 트랜잭션이 커밋한 알림을 보고 건너뛰도록 조회 전에 줄을 세운다
      await this.#dependencies.mutationLock.acquire([
        NotificationLockKeys.recentNotification(buildDeduplicationKey(data, strategy)),
      ]);

      const context = buildDeduplicationContextFields(data, strategy);
      const exists = await this.#dependencies.notificationHistoryReader.existsRecentNotification({
        userId: UserId.reconstitute(data.userId),
        type: data.type,
        since: this.#dependencies.clock.now().subtract({ milliseconds: strategy.windowMs }),
        ...(context.friendId != null && { friendId: UserId.reconstitute(context.friendId) }),
        ...(context.todoId != null && { todoId: TodoId.reconstitute(context.todoId) }),
        ...(context.nudgeId != null && { nudgeId: context.nudgeId }),
        ...(context.cheerId != null && { cheerId: context.cheerId }),
      });
      if (exists) {
        this.#dependencies.logger.debug({
          event: NotificationLogEvent.SEND_NOTIFICATION_WITH_DEDUPLICATION_DUPLICATE_SKIPPED,
          type: data.type,
          userId: data.userId,
        });
        return null;
      }

      return this.#dependencies.sendNotification.execute(data);
    });
  }
}
