import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type AfterCommitTaskRegistryPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { withNotificationCopyRevision } from "../../messages/delivery/notification-copy-revision.js";
import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../ports/delivery/notification.repository.port.js";
import { type PushDispatchStagingRepositoryPort } from "../../ports/delivery/push-dispatch-staging.repository.port.js";
import type { NotificationRecord } from "../../read-models/delivery/notification.read-model.js";
import type { PushDeliveryAfterCommitPublisher } from "../../services/delivery/push-delivery-after-commit.publisher.js";

/** 알림과 일반 push outbox를 한 transaction으로 만들고 부수효과는 commit 뒤 시작한다. */
interface SendNotificationDependencies {
  readonly notificationRepository: Pick<NotificationRepositoryPort, "createNotification">;
  readonly pushDispatchStaging: Pick<PushDispatchStagingRepositoryPort, "stage">;
  readonly cache: Pick<NotificationCachePort, "invalidateUnreadCount">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly afterCommit: Pick<AfterCommitTaskRegistryPort, "register">;
  readonly afterCommitPublisher: Pick<PushDeliveryAfterCommitPublisher, "register">;
  readonly logger: Pick<ApplicationLogger, "debug" | "warn">;
}

export class SendNotification {
  readonly #dependencies: SendNotificationDependencies;

  constructor(dependencies: SendNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(data: CreateNotificationData): Promise<NotificationRecord | null> {
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
      this.#dependencies.cache.invalidateUnreadCount(userId).catch(() => {
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
