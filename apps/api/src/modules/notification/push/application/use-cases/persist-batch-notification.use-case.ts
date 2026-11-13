import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { type NotificationRepositoryPort } from "../../../inbox/application/ports/notification.repository.port.js";
import type { PushDeliveryMode } from "../../domain/push-delivery-status.constants.js";
import { withNotificationCopyRevision } from "../messages/notification-copy-revision.messages.js";
import { type PushDispatchStagingRepositoryPort } from "../ports/push-dispatch-staging.repository.port.js";
import type { PersistedBatchNotificationResult } from "../read-models/push-delivery.read-model.js";
import type { PublishPushDeliveryAfterCommitUseCase } from "./publish-push-delivery-after-commit.use-case.js";

/**
 * 배치 알림과 push dispatch outbox를 원자 저장하고 후속 cache/dedup용 결과를 반환한다.
 *
 * push 발행은 after-commit으로 등록하고 cache·Redis dedup 정리는 호출자에게 분리한다.
 */
interface PersistBatchNotificationDependencies {
  readonly notificationRepository: Pick<
    NotificationRepositoryPort,
    "createManyNotificationsAndReturn"
  >;
  readonly pushDispatchStaging: Pick<PushDispatchStagingRepositoryPort, "stageMany">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly afterCommitPublisher: Pick<PublishPushDeliveryAfterCommitUseCase, "register">;
}

export interface BatchNotificationOptions {
  /**
   * 기본은 BATCH(수신자 설정을 한 번에 읽고 설정 행이 없으면 건너뜀)다. SINGLE은 알림만 함께 넣고 발송은
   * 단건 경로(설정 행이 없으면 기본 설정)로 해 단건 publish와 같은 결과를 낸다
   */
  readonly deliveryMode?: PushDeliveryMode;
}

export class PersistBatchNotificationUseCase {
  readonly #dependencies: PersistBatchNotificationDependencies;

  constructor(dependencies: PersistBatchNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    dataList: CreateNotificationData[],
    options: BatchNotificationOptions = {},
  ): Promise<PersistedBatchNotificationResult> {
    if (dataList.length === 0) {
      return { count: 0, sourceData: [] };
    }

    return this.#dependencies.unitOfWork.run(() =>
      this.#persist(dataList, options.deliveryMode ?? "BATCH"),
    );
  }

  async #persist(
    dataList: CreateNotificationData[],
    deliveryMode: PushDeliveryMode,
  ): Promise<PersistedBatchNotificationResult> {
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
        deliveryMode,
        force: forcedKeys.has(forceKey(notification.userId, notification.type)),
      })),
    );
    this.#dependencies.afterCommitPublisher.register(staged.map((dispatch) => dispatch.dispatchId));
    return { count: created.length, sourceData: dataList };
  }
}
