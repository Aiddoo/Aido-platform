import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  type AfterCommitTaskRegistryPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { NotificationRecord } from "../../../domain/records/delivery/notification.record.js";
import { withNotificationCopyRevision } from "../../messages/delivery/notification-copy-revision.js";
import { type NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import {
  DuplicateNotificationError,
  type NotificationRepositoryPort,
} from "../../ports/delivery/notification.repository.port.js";
import { type PushDispatchStagingRepositoryPort } from "../../ports/delivery/push-dispatch-staging.repository.port.js";
import type { PushDeliveryAfterCommitPublisher } from "../../services/delivery/push-delivery-after-commit.publisher.js";

/** 알림과 일반 push outbox를 한 transaction으로 만들고 부수효과는 commit 뒤 시작한다. */
interface SendNotificationDependencies {
  readonly notificationRepository: NotificationRepositoryPort;
  readonly pushDispatchStaging: PushDispatchStagingRepositoryPort;
  readonly cache: NotificationCachePort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommit: AfterCommitTaskRegistryPort;
  readonly afterCommitPublisher: PushDeliveryAfterCommitPublisher;
  readonly logger: ApplicationLogger;
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
        this.#dependencies.logger.debug(
          `Notification dedup: unique constraint prevented duplicate ${data.type} for userId=${data.userId}`,
        );
        return null;
      }
      throw error;
    }
  }

  #registerUnreadCountInvalidation(userId: string): void {
    this.#dependencies.afterCommit.register(() => {
      this.#dependencies.cache.invalidateUnreadCount(userId).catch((error: unknown) => {
        this.#dependencies.logger.warn(
          `Failed to invalidate unread notification count: userId=${userId}, ${error}`,
        );
      });
      return Promise.resolve();
    });
  }
}
