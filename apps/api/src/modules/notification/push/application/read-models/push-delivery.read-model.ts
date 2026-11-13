import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import type { PushDeliveryLane } from "../../domain/push-delivery-lane.domain-service.js";

/** delivery 작업 하나가 묶는 최대 dispatch 수. queue payload 검증도 같은 값을 쓴다. */
export const PUSH_DELIVERY_JOB_MAX_PUBLICATIONS = 100;

/** delivery 작업의 실행 한도(queue expire). 처리 lease도 이 값에서 계산해 둘이 어긋나지 않는다. */
export const PUSH_DELIVERY_JOB_EXPIRE_SECONDS = 5 * 60;

export interface PushDeliveryPublication {
  readonly dispatchId: number;
  readonly publishAttempt: number;
}

// outbox claim이 함께 읽는 발송 차선. queue payload에는 싣지 않는다
export interface ClaimedPushDeliveryPublication extends PushDeliveryPublication {
  readonly lane: PushDeliveryLane;
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
