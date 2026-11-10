import type { Provider } from "@nestjs/common";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { REMINDER_TIMEZONE_CACHE } from "#api/modules/notification/notification-reminders-cache.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PreferenceEntitlementPort } from "./application/ports/preference-entitlement.port.js";
import { ReminderScheduleEnqueuerPort } from "./application/ports/reminder-schedule-enqueuer.port.js";
import { ReminderTimezoneCachePort } from "./application/ports/reminder-timezone-cache.port.js";
import { StreakMilestoneNotifierPort } from "./application/ports/streak-milestone-notifier.port.js";
import { TodoCompletionStatsReaderPort } from "./application/ports/todo-completion-stats.reader.port.js";
import { TodoTimezoneRebaseEnqueuerPort } from "./application/ports/todo-timezone-rebase-enqueuer.port.js";
import { UserConsentRepositoryPort } from "./application/ports/user-consent.repository.port.js";
import { UserPreferenceRepositoryPort } from "./application/ports/user-preference.repository.port.js";
import { UserSettingsCachePort } from "./application/ports/user-settings-cache.port.js";
import { GetAiDataSharingConsentUseCase } from "./application/use-cases/get-ai-data-sharing-consent.use-case.js";
import { GetConsentRecordUseCase } from "./application/use-cases/get-consent-record.use-case.js";
import { GetConsentRecordsUseCase } from "./application/use-cases/get-consent-records.use-case.js";
import { GetConsentUseCase } from "./application/use-cases/get-consent.use-case.js";
import { GetPreferenceRecordUseCase } from "./application/use-cases/get-preference-record.use-case.js";
import { GetPreferenceRecordsUseCase } from "./application/use-cases/get-preference-records.use-case.js";
import { GetPreferenceUseCase } from "./application/use-cases/get-preference.use-case.js";
import { OnTodoToggledUseCase } from "./application/use-cases/on-todo-toggled.use-case.js";
import { ReadUserPreferencesUseCase } from "./application/use-cases/read-user-preferences.use-case.js";
import { RefreshPushTimezoneUseCase } from "./application/use-cases/refresh-push-timezone.use-case.js";
import { SeedUserSettingsUseCase } from "./application/use-cases/seed-user-settings.use-case.js";
import { UpdateAiDataSharingConsentUseCase } from "./application/use-cases/update-ai-data-sharing-consent.use-case.js";
import { UpdateMarketingConsentUseCase } from "./application/use-cases/update-marketing-consent.use-case.js";
import { UpdateMarketingPushConsentUseCase } from "./application/use-cases/update-marketing-push-consent.use-case.js";
import { UpdatePreferenceUseCase } from "./application/use-cases/update-preference.use-case.js";
import { UpsertPushLocaleUseCase } from "./application/use-cases/upsert-push-locale.use-case.js";
import { UpsertPushTimezoneUseCase } from "./application/use-cases/upsert-push-timezone.use-case.js";

// access 권한 판단과 notification 활성 시간대 캐시는 아직 Symbol 토큰이라 이 slice의 포트로 잇는다
const PREFERENCE_COLLABORATOR_PROVIDERS = [
  { provide: PreferenceEntitlementPort, useExisting: ENTITLEMENT_READER },
  { provide: ReminderTimezoneCachePort, useExisting: REMINDER_TIMEZONE_CACHE },
] satisfies Provider[];

export const refreshPushTimezoneProvider = provideUseCase(RefreshPushTimezoneUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
});

export const updatePreferenceProvider = provideUseCase(UpdatePreferenceUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  entitlement: PreferenceEntitlementPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  reminderEnqueuer: ReminderScheduleEnqueuerPort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
  logger: loggerFor(UpdatePreferenceUseCase),
});

export const upsertPushTimezoneProvider = provideUseCase(UpsertPushTimezoneUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
});

export const IDENTITY_PREFERENCES_PROVIDERS = [
  ...PREFERENCE_COLLABORATOR_PROVIDERS,
  refreshPushTimezoneProvider,
  updatePreferenceProvider,
  upsertPushTimezoneProvider,
  provideUseCase(ReadUserPreferencesUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    cache: UserSettingsCachePort,
  }),
  provideUseCase(GetPreferenceUseCase, {
    preferenceReader: ReadUserPreferencesUseCase,
    entitlement: PreferenceEntitlementPort,
  }),
  provideUseCase(GetPreferenceRecordUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
  }),
  provideUseCase(GetPreferenceRecordsUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
  }),
  provideUseCase(GetConsentUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetConsentRecordUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetConsentRecordsUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetAiDataSharingConsentUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(OnTodoToggledUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    statsReader: TodoCompletionStatsReaderPort,
    milestoneNotifier: StreakMilestoneNotifierPort,
    logger: loggerFor(OnTodoToggledUseCase),
  }),
  provideUseCase(SeedUserSettingsUseCase, {
    consentRepository: UserConsentRepositoryPort,
    preferenceRepository: UserPreferenceRepositoryPort,
  }),
  provideUseCase(UpdateAiDataSharingConsentUseCase, {
    consentRepository: UserConsentRepositoryPort,
    logger: loggerFor(UpdateAiDataSharingConsentUseCase),
  }),
  provideUseCase(UpdateMarketingConsentUseCase, {
    consentRepository: UserConsentRepositoryPort,
    logger: loggerFor(UpdateMarketingConsentUseCase),
  }),
  provideUseCase(UpdateMarketingPushConsentUseCase, {
    consentRepository: UserConsentRepositoryPort,
    logger: loggerFor(UpdateMarketingPushConsentUseCase),
  }),
  provideUseCase(UpsertPushLocaleUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    cache: UserSettingsCachePort,
  }),
] satisfies Provider[];
