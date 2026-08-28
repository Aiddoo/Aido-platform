export interface NotificationDeliveryPreference {
	readonly pushEnabled: boolean;
	readonly nightPushEnabled: boolean;
	readonly timezone: string;
	readonly locale: string;
	readonly morningReminderHour: number;
	readonly morningReminderMinute: number;
	readonly eveningReminderHour: number;
	readonly eveningReminderMinute: number;
	readonly timeFormat: "TWELVE_HOUR" | "TWENTY_FOUR_HOUR";
	readonly weatherMorningEnabled: boolean;
	readonly weatherMorningHour: number;
	readonly weatherMorningMinute: number;
	readonly weatherEveningEnabled: boolean;
	readonly weatherEveningHour: number;
	readonly weatherEveningMinute: number;
}

export interface NotificationMarketingConsent {
	readonly marketingPushAgreedAt: Date | null;
}

type NotificationDeliveryPreferenceWithUserId = NotificationDeliveryPreference & {
	readonly userId: string;
};

type NotificationMarketingConsentWithUserId = NotificationMarketingConsent & {
	readonly userId: string;
};

/**
 * 푸시 발송 판단에 필요한 사용자 설정 접근 포트 (notification 소유 ACL).
 *
 * user-settings 모듈의 concrete 저장소를 직접 주입하지 않고, 이 포트를 통해
 * 필요한 읽기/타임존·로케일 upsert만 노출한다. 반환 타입도 알림 판단에 필요한
 * 필드만 소유하여 user-settings의 내부 레코드 변화가 이 경계로 전파되지 않게 한다.
 */
export interface UserNotificationSettingsPort {
	upsertPushTimezone(userId: string, timezone: string): Promise<void>;
	upsertPushLocale(userId: string, locale: string): Promise<void>;
	getPreferenceRecord(userId: string): Promise<NotificationDeliveryPreference | null>;
	getPreferenceRecordsByUserIds(
		userIds: string[],
	): Promise<NotificationDeliveryPreferenceWithUserId[]>;
	getConsentRecord(userId: string): Promise<NotificationMarketingConsent | null>;
	getConsentRecordsByUserIds(userIds: string[]): Promise<NotificationMarketingConsentWithUserId[]>;
	updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void>;
}

export const USER_NOTIFICATION_SETTINGS = Symbol("USER_NOTIFICATION_SETTINGS");
