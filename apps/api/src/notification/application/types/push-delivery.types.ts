import type { CreateNotificationData } from "../ports/notification-data";

export interface PushDeliveryItem {
	readonly data: CreateNotificationData;
	readonly notificationId: number;
}

export interface PersistedBatchNotificationDispatch {
	readonly count: number;
	readonly items: readonly PushDeliveryItem[];
	readonly sourceData: readonly CreateNotificationData[];
}

export type DeliverPushNotificationsInput =
	| {
			readonly mode: "single";
			readonly item: PushDeliveryItem;
	  }
	| {
			readonly mode: "batch";
			readonly items: readonly PushDeliveryItem[];
	  };
