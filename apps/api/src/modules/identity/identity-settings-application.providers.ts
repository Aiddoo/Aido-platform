import { Logger, type FactoryProvider } from "@nestjs/common";

import { PREFERENCE_ENTITLEMENT } from "./application/ports/settings/preference-entitlement.port.js";
import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/settings/reminder-schedule.enqueuer.port.js";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/settings/streak-milestone.notifier.port.js";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/settings/todo-completion-stats.reader.port.js";
import { USER_CONSENT_REPOSITORY } from "./application/ports/settings/user-consent.repository.port.js";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/settings/user-preference.repository.port.js";
import { USER_SETTINGS_CACHE } from "./application/ports/settings/user-settings-cache.port.js";
import { UserPreferenceReader } from "./application/services/settings/user-preference-reader.service.js";
import { GetConsentRecord } from "./application/use-cases/settings/get-consent-record.use-case.js";
import { GetConsentRecords } from "./application/use-cases/settings/get-consent-records.use-case.js";
import { GetConsent } from "./application/use-cases/settings/get-consent.use-case.js";
import { GetPreferenceRecord } from "./application/use-cases/settings/get-preference-record.use-case.js";
import { GetPreferenceRecords } from "./application/use-cases/settings/get-preference-records.use-case.js";
import { GetPreference } from "./application/use-cases/settings/get-preference.use-case.js";
import { OnTodoToggled } from "./application/use-cases/settings/on-todo-toggled.use-case.js";
import { RefreshPushTimezone } from "./application/use-cases/settings/refresh-push-timezone.use-case.js";
import { SeedUserSettings } from "./application/use-cases/settings/seed-user-settings.use-case.js";
import { UpdateMarketingConsent } from "./application/use-cases/settings/update-marketing-consent.use-case.js";
import { UpdateMarketingPushConsent } from "./application/use-cases/settings/update-marketing-push-consent.use-case.js";
import { UpdatePreference } from "./application/use-cases/settings/update-preference.use-case.js";
import { UpsertPushLocale } from "./application/use-cases/settings/upsert-push-locale.use-case.js";
import { UpsertPushTimezone } from "./application/use-cases/settings/upsert-push-timezone.use-case.js";

export const userPreferenceReaderProvider: FactoryProvider<UserPreferenceReader> = {
  provide: UserPreferenceReader,
  inject: [USER_PREFERENCE_REPOSITORY, USER_SETTINGS_CACHE],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof UserPreferenceReader
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof UserPreferenceReader>[0]["cache"],
  ) => new UserPreferenceReader({ preferenceRepository, cache }),
};

export const getConsentProvider: FactoryProvider<GetConsent> = {
  provide: GetConsent,
  inject: [USER_CONSENT_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<typeof GetConsent>[0]["consentRepository"],
  ) => new GetConsent({ consentRepository }),
};

export const getConsentRecordProvider: FactoryProvider<GetConsentRecord> = {
  provide: GetConsentRecord,
  inject: [USER_CONSENT_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<typeof GetConsentRecord>[0]["consentRepository"],
  ) => new GetConsentRecord({ consentRepository }),
};

export const getConsentRecordsProvider: FactoryProvider<GetConsentRecords> = {
  provide: GetConsentRecords,
  inject: [USER_CONSENT_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<typeof GetConsentRecords>[0]["consentRepository"],
  ) => new GetConsentRecords({ consentRepository }),
};

export const getPreferenceProvider: FactoryProvider<GetPreference> = {
  provide: GetPreference,
  inject: [UserPreferenceReader, PREFERENCE_ENTITLEMENT],
  useFactory: (
    preferenceReader: ConstructorParameters<typeof GetPreference>[0]["preferenceReader"],
    entitlement: ConstructorParameters<typeof GetPreference>[0]["entitlement"],
  ) => new GetPreference({ preferenceReader, entitlement }),
};

export const getPreferenceRecordProvider: FactoryProvider<GetPreferenceRecord> = {
  provide: GetPreferenceRecord,
  inject: [USER_PREFERENCE_REPOSITORY],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof GetPreferenceRecord
    >[0]["preferenceRepository"],
  ) => new GetPreferenceRecord({ preferenceRepository }),
};

export const getPreferenceRecordsProvider: FactoryProvider<GetPreferenceRecords> = {
  provide: GetPreferenceRecords,
  inject: [USER_PREFERENCE_REPOSITORY],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof GetPreferenceRecords
    >[0]["preferenceRepository"],
  ) => new GetPreferenceRecords({ preferenceRepository }),
};

export const onTodoToggledProvider: FactoryProvider<OnTodoToggled> = {
  provide: OnTodoToggled,
  inject: [USER_PREFERENCE_REPOSITORY, TODO_COMPLETION_STATS_READER, STREAK_MILESTONE_NOTIFIER],
  useFactory: (
    preferenceRepository: ConstructorParameters<typeof OnTodoToggled>[0]["preferenceRepository"],
    statsReader: ConstructorParameters<typeof OnTodoToggled>[0]["statsReader"],
    milestoneNotifier: ConstructorParameters<typeof OnTodoToggled>[0]["milestoneNotifier"],
  ) =>
    new OnTodoToggled({
      preferenceRepository,
      statsReader,
      milestoneNotifier,
      logger: new Logger(OnTodoToggled.name),
    }),
};

export const refreshPushTimezoneProvider: FactoryProvider<RefreshPushTimezone> = {
  provide: RefreshPushTimezone,
  inject: [USER_PREFERENCE_REPOSITORY, USER_SETTINGS_CACHE],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof RefreshPushTimezone
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof RefreshPushTimezone>[0]["cache"],
  ) => new RefreshPushTimezone({ preferenceRepository, cache }),
};

export const seedUserSettingsProvider: FactoryProvider<SeedUserSettings> = {
  provide: SeedUserSettings,
  inject: [USER_CONSENT_REPOSITORY, USER_PREFERENCE_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<typeof SeedUserSettings>[0]["consentRepository"],
    preferenceRepository: ConstructorParameters<typeof SeedUserSettings>[0]["preferenceRepository"],
  ) =>
    new SeedUserSettings({
      consentRepository,
      preferenceRepository,
    }),
};

export const updateMarketingConsentProvider: FactoryProvider<UpdateMarketingConsent> = {
  provide: UpdateMarketingConsent,
  inject: [USER_CONSENT_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<typeof UpdateMarketingConsent>[0]["consentRepository"],
  ) =>
    new UpdateMarketingConsent({
      consentRepository,
      logger: new Logger(UpdateMarketingConsent.name),
    }),
};

export const updateMarketingPushConsentProvider: FactoryProvider<UpdateMarketingPushConsent> = {
  provide: UpdateMarketingPushConsent,
  inject: [USER_CONSENT_REPOSITORY],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof UpdateMarketingPushConsent
    >[0]["consentRepository"],
  ) =>
    new UpdateMarketingPushConsent({
      consentRepository,
      logger: new Logger(UpdateMarketingPushConsent.name),
    }),
};

export const updatePreferenceProvider: FactoryProvider<UpdatePreference> = {
  provide: UpdatePreference,
  inject: [
    USER_PREFERENCE_REPOSITORY,
    PREFERENCE_ENTITLEMENT,
    USER_SETTINGS_CACHE,
    REMINDER_SCHEDULE_ENQUEUER,
  ],
  useFactory: (
    preferenceRepository: ConstructorParameters<typeof UpdatePreference>[0]["preferenceRepository"],
    entitlement: ConstructorParameters<typeof UpdatePreference>[0]["entitlement"],
    cache: ConstructorParameters<typeof UpdatePreference>[0]["cache"],
    reminderEnqueuer: ConstructorParameters<typeof UpdatePreference>[0]["reminderEnqueuer"],
  ) =>
    new UpdatePreference({
      preferenceRepository,
      entitlement,
      cache,
      reminderEnqueuer,
      logger: new Logger(UpdatePreference.name),
    }),
};

export const upsertPushLocaleProvider: FactoryProvider<UpsertPushLocale> = {
  provide: UpsertPushLocale,
  inject: [USER_PREFERENCE_REPOSITORY, USER_SETTINGS_CACHE],
  useFactory: (
    preferenceRepository: ConstructorParameters<typeof UpsertPushLocale>[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof UpsertPushLocale>[0]["cache"],
  ) => new UpsertPushLocale({ preferenceRepository, cache }),
};

export const upsertPushTimezoneProvider: FactoryProvider<UpsertPushTimezone> = {
  provide: UpsertPushTimezone,
  inject: [USER_PREFERENCE_REPOSITORY, USER_SETTINGS_CACHE],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof UpsertPushTimezone
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof UpsertPushTimezone>[0]["cache"],
  ) => new UpsertPushTimezone({ preferenceRepository, cache }),
};
