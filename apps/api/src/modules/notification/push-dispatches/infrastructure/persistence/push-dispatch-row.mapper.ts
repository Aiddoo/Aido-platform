import type { pushDispatch, pushDispatchOutbox } from "#api/platform/database/schema/index";

import type { PushDispatch } from "../../domain/push-dispatch.aggregate.js";

// 만든 시각은 DB 기본값이 정한다. 처음 쓴 시각은 updatedAt에 남긴다
export function toPushDispatchRow(dispatch: PushDispatch): typeof pushDispatch.$inferInsert {
  const primitives = dispatch.toPrimitives();
  return {
    id: primitives.id,
    notificationId: primitives.notificationId,
    userId: primitives.recipientId,
    purpose: primitives.purpose,
    campaignKey: primitives.campaignKey,
    variantId: primitives.variantId,
    status: primitives.status,
    updatedAt: primitives.stagedAt,
  };
}

export function toPushDispatchOutboxRow(
  dispatch: PushDispatch,
): typeof pushDispatchOutbox.$inferInsert {
  const primitives = dispatch.toPrimitives();
  return {
    dispatchId: primitives.id,
    deliveryMode: primitives.deliveryMode,
    force: primitives.force,
    updatedAt: primitives.stagedAt,
  };
}
