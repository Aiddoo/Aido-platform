import type { ClaimedPushDelivery } from "../../application/ports/push-delivery-claim.repository.port.js";

export interface ClaimedRow {
  readonly dispatchId: number;
  readonly deliveryAttemptCount: number;
  readonly publishAttempt: number;
}

interface ClaimedDispatchRow {
  readonly id: number;
  readonly notificationId: number;
  readonly rateLimitReservedAt: unknown;
  readonly notification: {
    readonly userId: string;
    readonly type: ClaimedPushDelivery["item"]["data"]["type"];
    readonly title: string;
    readonly body: string;
    readonly actionType: NonNullable<ClaimedPushDelivery["item"]["data"]["action"]>["type"];
    readonly actionUrl: string | null;
    readonly purpose: ClaimedPushDelivery["item"]["data"]["purpose"];
    readonly campaignKey: string | null;
    readonly variantId: string | null;
    readonly todoId: number | null;
    readonly friendId: string | null;
    readonly nudgeId: number | null;
    readonly cheerId: number | null;
    readonly metadata: unknown;
    readonly notificationDate: Temporal.PlainDate | null;
  };
}

function toNotificationMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

// claim한 발송 행과 알림 행을 worker가 쓰는 발송 하나로 바꾼다
export function toClaimedPushDelivery(input: {
  readonly dispatch: ClaimedDispatchRow;
  readonly outbox: {
    readonly deliveryMode: ClaimedPushDelivery["deliveryMode"];
    readonly force: boolean;
  };
  readonly claim: ClaimedRow;
  readonly processingJobId: string;
}): ClaimedPushDelivery {
  const { dispatch, outbox, claim, processingJobId } = input;
  const notification = dispatch.notification;
  return {
    fence: {
      dispatchId: dispatch.id,
      publishAttempt: claim.publishAttempt,
      processingJobId,
      deliveryAttemptCount: claim.deliveryAttemptCount,
    },
    deliveryMode: outbox.deliveryMode,
    force: outbox.force,
    rateLimitReservation: dispatch.rateLimitReservedAt
      ? { status: "reserved" as const }
      : { status: "pending" as const },
    item: {
      notificationId: dispatch.notificationId,
      data: {
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        action: {
          type: notification.actionType,
          ...(notification.actionUrl ? { url: notification.actionUrl } : {}),
        },
        purpose: notification.purpose,
        campaignKey: notification.campaignKey,
        variantId: notification.variantId,
        todoId: notification.todoId,
        friendId: notification.friendId,
        nudgeId: notification.nudgeId,
        cheerId: notification.cheerId,
        metadata: toNotificationMetadata(notification.metadata),
        notificationDate: notification.notificationDate,
        force: outbox.force,
      },
    },
  };
}
