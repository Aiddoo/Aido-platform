import type { NOTIFICATION_PURPOSES } from "@aido/api/vocabulary";

import type { PushDeliveryMode } from "../../domain/push-delivery-status.constants.js";

export interface StagePushDispatchInput {
  readonly notificationId: number;
  readonly userId: string;
  readonly purpose: (typeof NOTIFICATION_PURPOSES)[number];
  readonly campaignKey?: string | null;
  readonly variantId?: string | null;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
}

export interface StagedPushDispatch {
  readonly dispatchId: number;
  readonly notificationId: number;
}

// 알림 트랜잭션 안에서 일반 push dispatch와 전용 outbox를 함께 만든다
export abstract class PushDispatchStagingRepositoryPort {
  abstract stage(input: StagePushDispatchInput): Promise<StagedPushDispatch>;
  abstract stageMany(
    inputs: readonly StagePushDispatchInput[],
  ): Promise<readonly StagedPushDispatch[]>;
}
