import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";

/** delivery 작업 하나가 묶는 최대 dispatch 수. queue payload 검증도 같은 값을 쓴다. */
export const PUSH_DELIVERY_JOB_MAX_PUBLICATIONS = 100;

export interface PushDeliveryPublication {
  readonly dispatchId: number;
  readonly publishAttempt: number;
}

export type PushDispatchSkipReason =
  | "PUSH_SETTINGS_MISSING"
  | "PUSH_DISABLED"
  | "MARKETING_CONSENT_REQUIRED"
  | "MARKETING_QUIET_HOURS"
  | "NIGHT_PUSH_DISABLED"
  | "RATE_LIMITED"
  | "ENGAGEMENT_RATE_LIMITED"
  | "NO_ACTIVE_TOKEN"
  | "UNSUPPORTED_APP_CAPABILITY";

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
