import { type UnitOfWorkPort } from "#api/shared/application/ports/index";

import { withNotificationCopyRevision } from "../../messages/delivery/notification-copy-revision.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { type NotificationRepositoryPort } from "../../ports/delivery/notification.repository.port.js";
import { type PushDispatchStagingRepositoryPort } from "../../ports/delivery/push-dispatch-staging.repository.port.js";
import type { PushDeliveryAfterCommitPublisher } from "../../services/delivery/push-delivery-after-commit.publisher.js";
import type { PersistedBatchNotificationResult } from "../../types/delivery/push-delivery.types.js";

/**
 * 배치 알림과 push dispatch outbox를 원자 저장하고 후속 cache/dedup용 결과를 반환한다.
 *
 * push 발행은 after-commit으로 등록하고 cache·Redis dedup 정리는 호출자에게 분리한다.
 */
interface PersistBatchNotificationDependencies {
  readonly notificationRepository: NotificationRepositoryPort;
  readonly pushDispatchStaging: PushDispatchStagingRepositoryPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly afterCommitPublisher: PushDeliveryAfterCommitPublisher;
}

export class PersistBatchNotification {
  readonly #dependencies: PersistBatchNotificationDependencies;

  constructor(dependencies: PersistBatchNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
    if (dataList.length === 0) {
      return { count: 0, sourceData: [] };
    }

    return this.#dependencies.unitOfWork.run(() => this.#persist(dataList));
  }

  async #persist(dataList: CreateNotificationData[]): Promise<PersistedBatchNotificationResult> {
    const created =
      await this.#dependencies.notificationRepository.createManyNotificationsAndReturn(
        dataList.map(withNotificationCopyRevision),
      );
    const forceKey = (userId: string, type: string): string => `${userId}\u0000${type}`;
    const forcedKeys = new Set(
      dataList
        .filter((data) => data.force === true)
        .map((data) => forceKey(data.userId, data.type)),
    );

    const staged = await this.#dependencies.pushDispatchStaging.stageMany(
      created.map((notification) => ({
        notificationId: notification.id,
        userId: notification.userId,
        purpose: notification.purpose,
        campaignKey: notification.campaignKey,
        variantId: notification.variantId,
        deliveryMode: "BATCH",
        force: forcedKeys.has(forceKey(notification.userId, notification.type)),
      })),
    );
    this.#dependencies.afterCommitPublisher.register(staged.map((dispatch) => dispatch.dispatchId));
    return { count: created.length, sourceData: dataList };
  }
}
