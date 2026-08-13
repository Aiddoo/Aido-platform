import { Injectable } from "@nestjs/common";
import type { ConsentSeedInput } from "../../application/ports/user-consent.repository.port";
import type {
	UserNotificationSettingsAccessPort,
	UserSettingsProvisionerPort,
	UserStreakAccessPort,
} from "../../application/ports/user-settings-access.port";
import { GetConsentRecordUseCase } from "../../application/use-cases/get-consent-record/get-consent-record.use-case";
import { GetConsentRecordsUseCase } from "../../application/use-cases/get-consent-records/get-consent-records.use-case";
import { GetPreferenceRecordUseCase } from "../../application/use-cases/get-preference-record/get-preference-record.use-case";
import { GetPreferenceRecordsUseCase } from "../../application/use-cases/get-preference-records/get-preference-records.use-case";
import { OnTodoToggledUseCase } from "../../application/use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { SeedUserSettingsUseCase } from "../../application/use-cases/seed-user-settings/seed-user-settings.use-case";
import { UpdateMarketingPushConsentUseCase } from "../../application/use-cases/update-marketing-push-consent/update-marketing-push-consent.use-case";
import { UpsertPushLocaleUseCase } from "../../application/use-cases/upsert-push-locale/upsert-push-locale.use-case";
import { UpsertPushTimezoneUseCase } from "../../application/use-cases/upsert-push-timezone/upsert-push-timezone.use-case";

/** 외부 컨텍스트에 공개한 좁은 capability를 내부 endpoint UseCase에 연결한다. */
@Injectable()
export class UserSettingsAccessAdapter
	implements
		UserSettingsProvisionerPort,
		UserStreakAccessPort,
		UserNotificationSettingsAccessPort
{
	constructor(
		private readonly seedUserSettingsUseCase: SeedUserSettingsUseCase,
		private readonly onTodoToggledUseCase: OnTodoToggledUseCase,
		private readonly getPreferenceRecordUseCase: GetPreferenceRecordUseCase,
		private readonly getPreferenceRecordsUseCase: GetPreferenceRecordsUseCase,
		private readonly getConsentRecordUseCase: GetConsentRecordUseCase,
		private readonly getConsentRecordsUseCase: GetConsentRecordsUseCase,
		private readonly upsertPushTimezoneUseCase: UpsertPushTimezoneUseCase,
		private readonly upsertPushLocaleUseCase: UpsertPushLocaleUseCase,
		private readonly updateMarketingPushConsentUseCase: UpdateMarketingPushConsentUseCase,
	) {}

	seedDefaults(userId: string, consent: ConsentSeedInput): Promise<void> {
		return this.seedUserSettingsUseCase.execute(userId, consent);
	}

	recordTodoToggle(
		userId: string,
		completed: boolean,
		timezone: string,
	): Promise<void> {
		return this.onTodoToggledUseCase.execute(userId, completed, timezone);
	}

	getPreferenceRecord(userId: string) {
		return this.getPreferenceRecordUseCase.execute(userId);
	}

	getPreferenceRecordsByUserIds(userIds: string[]) {
		return this.getPreferenceRecordsUseCase.execute(userIds);
	}

	getConsentRecord(userId: string) {
		return this.getConsentRecordUseCase.execute(userId);
	}

	getConsentRecordsByUserIds(userIds: string[]) {
		return this.getConsentRecordsUseCase.execute(userIds);
	}

	upsertPushTimezone(userId: string, timezone: string): Promise<void> {
		return this.upsertPushTimezoneUseCase.execute(userId, timezone);
	}

	upsertPushLocale(userId: string, locale: string): Promise<void> {
		return this.upsertPushLocaleUseCase.execute(userId, locale);
	}

	async updateMarketingPushConsent(
		userId: string,
		agreed: boolean,
	): Promise<void> {
		await this.updateMarketingPushConsentUseCase.execute(userId, agreed);
	}
}
