export type { PushDispatchSkipReason } from "@aido/api/vocabulary";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";

/** delivery 작업 하나가 묶는 최대 dispatch 수. queue payload 검증도 같은 값을 쓴다. */
export const PUSH_DELIVERY_JOB_MAX_PUBLICATIONS = 100;

export interface PushDeliveryPublication {
  readonly dispatchId: number;
  readonly publishAttempt: number;
}

export interface PushDeliveryItem {
  readonly data: CreateNotificationData;
  readonly notificationId: number;
}

export interface PersistedBatchNotificationResult {
  readonly count: number;
  readonly sourceData: readonly CreateNotificationData[];
}

export interface DeliverPushNotificationsInput {
  readonly publications: readonly PushDeliveryPublication[];
  readonly processingJobId: string;
  readonly processingJobAttempt: number;
  readonly isFinalAttempt: boolean;
}
