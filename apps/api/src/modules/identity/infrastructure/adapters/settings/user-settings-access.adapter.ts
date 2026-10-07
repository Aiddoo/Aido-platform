import { Injectable } from "@nestjs/common";

import type { ConsentSeedInput } from "../../../application/ports/settings/user-consent.repository.port.js";
import type {
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
} from "../../../application/ports/settings/user-settings-access.port.js";
import { GetConsentRecord } from "../../../application/use-cases/settings/get-consent-record.use-case.js";
import { GetConsentRecords } from "../../../application/use-cases/settings/get-consent-records.use-case.js";
import { GetPreferenceRecord } from "../../../application/use-cases/settings/get-preference-record.use-case.js";
import { GetPreferenceRecords } from "../../../application/use-cases/settings/get-preference-records.use-case.js";
import { OnTodoToggled } from "../../../application/use-cases/settings/on-todo-toggled.use-case.js";
import { SeedUserSettings } from "../../../application/use-cases/settings/seed-user-settings.use-case.js";
import { UpdateMarketingPushConsent } from "../../../application/use-cases/settings/update-marketing-push-consent.use-case.js";
import { UpsertPushLocale } from "../../../application/use-cases/settings/upsert-push-locale.use-case.js";
import { UpsertPushTimezone } from "../../../application/use-cases/settings/upsert-push-timezone.use-case.js";

/** 외부 컨텍스트에 공개한 좁은 capability를 내부 endpoint UseCase에 연결한다. */
@Injectable()
export class UserSettingsAccessAdapter
  implements UserSettingsProvisionerPort, UserStreakAccessPort, UserNotificationSettingsAccessPort
{
  constructor(
    private readonly seedUserSettingsUseCase: SeedUserSettings,
    private readonly onTodoToggledUseCase: OnTodoToggled,
    private readonly getPreferenceRecordUseCase: GetPreferenceRecord,
    private readonly getPreferenceRecordsUseCase: GetPreferenceRecords,
    private readonly getConsentRecordUseCase: GetConsentRecord,
    private readonly getConsentRecordsUseCase: GetConsentRecords,
    private readonly upsertPushTimezoneUseCase: UpsertPushTimezone,
    private readonly upsertPushLocaleUseCase: UpsertPushLocale,
    private readonly updateMarketingPushConsentUseCase: UpdateMarketingPushConsent,
  ) {}

  seedDefaults(userId: string, consent: ConsentSeedInput): Promise<void> {
    return this.seedUserSettingsUseCase.execute(userId, consent);
  }

  recordTodoToggle(userId: string, completed: boolean, timezone: string): Promise<void> {
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

  async updateMarketingPushConsent(userId: string, agreed: boolean): Promise<void> {
    await this.updateMarketingPushConsentUseCase.execute(userId, agreed);
  }
}
