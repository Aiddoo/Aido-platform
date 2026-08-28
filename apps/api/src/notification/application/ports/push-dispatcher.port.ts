import type { PushDeliveryItem } from "../types/push-delivery.types";
import type { CreateNotificationData } from "./notification-data";

export const PUSH_DISPATCHER = Symbol("PUSH_DISPATCHER");

/**
 * 영속 알림 호출부를 위한 in-process 호환 경계.
 * 실제 전달 정책은 DeliverPushNotificationsUseCase가 소유한다.
 */
export interface PushDispatcherPort {
	fireAndForgetPush(data: CreateNotificationData, notificationId: number): void;
	fireAndForgetBatchPush(items: readonly PushDeliveryItem[]): void;
}
