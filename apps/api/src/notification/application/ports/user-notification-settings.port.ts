import type {
	UserConsentRecord,
	UserConsentRecordWithId,
	UserPreferenceRecord,
	UserPreferenceRecordWithId,
} from "@/user-settings";

/**
 * 푸시 발송 판단에 필요한 사용자 설정 접근 포트 (notification 소유 ACL).
 *
 * user-settings 모듈의 concrete 저장소를 직접 주입하지 않고, 이 포트를 통해
 * 필요한 읽기/타임존·로케일 upsert만 노출한다. 어댑터가 UserSettingsFacade에 위임한다.
 */
export interface UserNotificationSettingsPort {
	upsertPushTimezone(userId: string, timezone: string): Promise<void>;
	upsertPushLocale(userId: string, locale: string): Promise<void>;
	getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null>;
	getPreferenceRecordsByUserIds(userIds: string[]): Promise<UserPreferenceRecordWithId[]>;
	getConsentRecord(userId: string): Promise<UserConsentRecord | null>;
	getConsentRecordsByUserIds(userIds: string[]): Promise<UserConsentRecordWithId[]>;
	updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void>;
}

export const USER_NOTIFICATION_SETTINGS = Symbol("USER_NOTIFICATION_SETTINGS");
