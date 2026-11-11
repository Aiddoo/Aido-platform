import { type AfterCommitTaskRegistryPort } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../../inbox/application/ports/notification.repository.port.js";
import type { InboxNotification } from "../../../inbox/application/read-models/inbox-notification.read-model.js";
import { withNotificationCopyRevision } from "../messages/notification-copy-revision.messages.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { type PushDispatchStagingRepositoryPort } from "../ports/push-dispatch-staging.repository.port.js";
import type { PublishPushDeliveryAfterCommitUseCase } from "./publish-push-delivery-after-commit.use-case.js";

/** 알림과 일반 push outbox를 한 transaction으로 만들고 부수효과는 commit 뒤 시작한다. */
interface SendNotificationDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "createNotification">;
  readonly pushDispatchStaging: Pick<PushDispatchStagingRepositoryPort, "stage">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly afterCommitPublisher: Pick<PublishPushDeliveryAfterCommitUseCase, "register">;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "warn">;
}

export class SendNotificationUseCase {
  readonly #dependencies: SendNotificationDependencies;

  constructor(dependencies: SendNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<InboxNotification | null> {
    try {
      return await this.#dependencies.unitOfWork.run(async () => {
        const notification = await this.#dependencies.notificationRepository.createNotification(
          withNotificationCopyRevision(data),
        );
        const staged = await this.#dependencies.pushDispatchStaging.stage({
          notificationId: notification.id,
          userId: data.userId,
          purpose: data.purpose ?? "TRANSACTIONAL",
          campaignKey: data.campaignKey,
          variantId: data.variantId,
          deliveryMode: "SINGLE",
          force: false,
        });
        this.#registerUnreadCountInvalidation(data.userId);
        this.#dependencies.afterCommitPublisher.register([staged.dispatchId]);
        return notification;
      });
    } catch (error) {
      if (error instanceof DuplicateNotificationError) {
        this.#dependencies.logger.debug({
          event: NotificationDeliveryLogEvent.SEND_NOTIFICATION_DUPLICATE_PREVENTED,
          type: data.type,
          userId: data.userId,
        });
        return null;
      }
      throw error;
    }
  }

  #registerUnreadCountInvalidation(userId: string): void {
    this.#dependencies.afterCommit.register(() => {
      this.#dependencies.cache.invalidateUnreadCount(UserId.reconstitute(userId)).catch(() => {
        this.#dependencies.logger.warn({
          event: NotificationDeliveryLogEvent.SEND_NOTIFICATION_UNREAD_CACHE_FAILED,
          userId,
          errorType: "cache-invalidation",
        });
      });
      return Promise.resolve();
    });
  }
}
