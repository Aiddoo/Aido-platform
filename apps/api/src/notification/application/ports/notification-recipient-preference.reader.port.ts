import type { NotificationDeliveryPreference } from "./user-notification-settings.port";

export const NOTIFICATION_RECIPIENT_PREFERENCE_READER = Symbol(
	"NOTIFICATION_RECIPIENT_PREFERENCE_READER",
);

/** 단건 알림 전달에 필요한 수신자 설정의 기본값·캐시 일관성을 제공한다. */
export interface NotificationRecipientPreferenceReaderPort {
	getPreference(userId: string): Promise<NotificationDeliveryPreference>;
}
