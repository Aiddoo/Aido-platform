import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type PersistedBatchNotificationResultReadModel,
  type PublishPushDeliveryAfterCommitUseCase,
  type PushDeliveryMode,
  PushDispatch,
  type PushDispatchRepositoryPort,
} from "../../../push-dispatches/notification-push-dispatches.public.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { NotificationId } from "../../../shared/domain/notification-id.vo.js";
import { withNotificationCopyRevision } from "../messages/notification-copy-revision.messages.js";
import { pushDispatchIdMissing } from "../notifications.errors.js";
import { type NotificationRepositoryPort } from "../ports/notification.repository.port.js";

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
  readonly pushDispatchRepository: Pick<PushDispatchRepositoryPort, "nextIds" | "saveAll">;
  readonly clock: Pick<ClockPort, "now">;
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
  ): Promise<PersistedBatchNotificationResultReadModel> {
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
  ): Promise<PersistedBatchNotificationResultReadModel> {
    const created =
      await this.#dependencies.notificationRepository.createManyNotificationsAndReturn(
        dataList.map(withNotificationCopyRevision),
      );
    // 회차 dedup index에 모두 걸려 새 행이 없으면 발송도 없다(재처리·catch-up)
    if (created.length === 0) {
      return { count: 0, sourceData: dataList };
    }
    const forceKey = (userId: string, type: string): string => `${userId}\u0000${type}`;
    const forcedKeys = new Set(
      dataList
        .filter((data) => data.force === true)
        .map((data) => forceKey(data.userId, data.type)),
    );

    const dispatchIds = await this.#dependencies.pushDispatchRepository.nextIds(created.length);
    const now = this.#dependencies.clock.now();
    const dispatches = created.map((notification, index) => {
      const dispatchId = dispatchIds[index];
      if (dispatchId == null) {
        throw pushDispatchIdMissing();
      }
      return PushDispatch.create({
        id: dispatchId,
        notificationId: NotificationId.reconstitute(notification.id),
        recipientId: UserId.reconstitute(notification.userId),
        purpose: notification.purpose,
        campaignKey: notification.campaignKey,
        variantId: notification.variantId,
        deliveryMode,
        force: forcedKeys.has(forceKey(notification.userId, notification.type)),
        now,
      });
    });
    await this.#dependencies.pushDispatchRepository.saveAll(dispatches);
    this.#dependencies.afterCommitPublisher.register(
      dispatches.map((dispatch) => dispatch.id.value),
    );
    return { count: created.length, sourceData: dataList };
  }
}
