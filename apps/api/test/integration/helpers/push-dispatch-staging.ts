import type { TransactionHost } from "@nestjs-cls/transactional";

import type { PushDeliveryMode } from "#api/modules/notification/push-dispatches/domain/push-delivery-status.constants";
import { PushDispatch } from "#api/modules/notification/push-dispatches/domain/push-dispatch.aggregate";
import { DrizzlePushDispatchRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-dispatch.repository";
import { NotificationId } from "#api/modules/notification/shared/domain/notification-id.vo";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface StagePushDispatchInput {
  readonly notificationId: number;
  readonly userId: string;
  readonly purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
  readonly campaignKey?: string | null;
  readonly variantId?: string | null;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
}

// 알림 행 하나에 발송·아웃박스를 알림 발행과 같은 모양으로 만든다. 발송 단계 통합 테스트의 준비 단계다
export function createPushDispatchStaging(
  transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
  clock: ClockPort,
) {
  const repository = new DrizzlePushDispatchRepository(transactionHost);
  return {
    async stage(
      input: StagePushDispatchInput,
    ): Promise<{ readonly dispatchId: number; readonly notificationId: number }> {
      const [id] = await repository.nextIds(1);
      if (id == null) {
        throw new Error("push dispatch id missing");
      }
      await repository.saveAll([
        PushDispatch.create({
          id,
          notificationId: NotificationId.reconstitute(input.notificationId),
          recipientId: UserId.reconstitute(input.userId),
          purpose: input.purpose,
          campaignKey: input.campaignKey ?? null,
          variantId: input.variantId ?? null,
          deliveryMode: input.deliveryMode,
          force: input.force,
          now: clock.now(),
        }),
      ]);
      return { dispatchId: id.value, notificationId: input.notificationId };
    },
  };
}
