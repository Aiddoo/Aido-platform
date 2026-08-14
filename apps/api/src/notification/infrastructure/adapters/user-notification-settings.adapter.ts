import { Inject, Injectable } from "@nestjs/common";

import {
	USER_NOTIFICATION_SETTINGS_ACCESS,
	type UserConsentRecord,
	type UserConsentRecordWithId,
	type UserNotificationSettingsAccessPort,
	type UserPreferenceRecord,
	type UserPreferenceRecordWithId,
} from "@/user-settings";
import type { UserNotificationSettingsPort } from "../../application/ports/user-notification-settings.port";

/**
 * notification의 설정 포트를 user-settings의 공개 capability에 연결한다.
 */
@Injectable()
export class UserNotificationSettingsAdapter
	implements UserNotificationSettingsPort
{
	constructor(
		@Inject(USER_NOTIFICATION_SETTINGS_ACCESS)
		private readonly userSettingsAccess: UserNotificationSettingsAccessPort,
	) {}

	upsertPushTimezone(userId: string, timezone: string): Promise<void> {
		return this.userSettingsAccess.upsertPushTimezone(userId, timezone);
	}

	upsertPushLocale(userId: string, locale: string): Promise<void> {
		return this.userSettingsAccess.upsertPushLocale(userId, locale);
	}

	getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null> {
		return this.userSettingsAccess.getPreferenceRecord(userId);
	}

	getPreferenceRecordsByUserIds(
		userIds: string[],
	): Promise<UserPreferenceRecordWithId[]> {
		return this.userSettingsAccess.getPreferenceRecordsByUserIds(userIds);
	}

	getConsentRecord(userId: string): Promise<UserConsentRecord | null> {
		return this.userSettingsAccess.getConsentRecord(userId);
	}

	getConsentRecordsByUserIds(
		userIds: string[],
	): Promise<UserConsentRecordWithId[]> {
		return this.userSettingsAccess.getConsentRecordsByUserIds(userIds);
	}

	async updateMarketingPushConsent(
		userId: string,
		agreed: boolean,
	): Promise<void> {
		await this.userSettingsAccess.updateMarketingPushConsent(userId, agreed);
	}
}
