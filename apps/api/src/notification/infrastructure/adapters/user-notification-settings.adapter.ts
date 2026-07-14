import { Injectable } from "@nestjs/common";

import {
	type UserConsentRecord,
	type UserConsentRecordWithId,
	type UserPreferenceRecord,
	type UserPreferenceRecordWithId,
	UserSettingsFacade,
} from "@/user-settings";
import type { UserNotificationSettingsPort } from "../../application/ports/user-notification-settings.port";

/**
 * UserNotificationSettingsPort 어댑터 — UserSettingsFacade에 위임한다.
 * notification → user-settings 단방향 의존을 파사드 배럴 경유로만 유지한다.
 */
@Injectable()
export class UserNotificationSettingsAdapter
	implements UserNotificationSettingsPort
{
	constructor(private readonly userSettings: UserSettingsFacade) {}

	upsertPushTimezone(userId: string, timezone: string): Promise<void> {
		return this.userSettings.upsertPushTimezone(userId, timezone);
	}

	upsertPushLocale(userId: string, locale: string): Promise<void> {
		return this.userSettings.upsertPushLocale(userId, locale);
	}

	getPreferenceRecord(userId: string): Promise<UserPreferenceRecord | null> {
		return this.userSettings.getPreferenceRecord(userId);
	}

	getPreferenceRecordsByUserIds(
		userIds: string[],
	): Promise<UserPreferenceRecordWithId[]> {
		return this.userSettings.getPreferenceRecordsByUserIds(userIds);
	}

	getConsentRecord(userId: string): Promise<UserConsentRecord | null> {
		return this.userSettings.getConsentRecord(userId);
	}

	getConsentRecordsByUserIds(
		userIds: string[],
	): Promise<UserConsentRecordWithId[]> {
		return this.userSettings.getConsentRecordsByUserIds(userIds);
	}

	async updateMarketingPushConsent(
		userId: string,
		agreed: boolean,
	): Promise<void> {
		await this.userSettings.updateMarketingPushConsent(userId, agreed);
	}
}
