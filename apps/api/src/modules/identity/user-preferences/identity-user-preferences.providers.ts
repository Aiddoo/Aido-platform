import type { Provider } from "@nestjs/common";

import { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import { ReminderTimezoneCachePort as NotificationReminderTimezoneCachePort } from "#api/modules/notification/reminders/notification-reminders-jobs.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
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
import { GetConsentReadModelUseCase } from "./application/use-cases/get-consent-read-model.use-case.js";
import { GetConsentReadModelsUseCase } from "./application/use-cases/get-consent-read-models.use-case.js";
import { GetConsentUseCase } from "./application/use-cases/get-consent.use-case.js";
import { GetPreferenceReadModelUseCase } from "./application/use-cases/get-preference-read-model.use-case.js";
import { GetPreferenceReadModelsUseCase } from "./application/use-cases/get-preference-read-models.use-case.js";
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

// access 권한 판단과 notification 활성 시간대 캐시를 이 slice의 포트로 잇는다
const PREFERENCE_COLLABORATOR_PROVIDERS = [
  { provide: PreferenceEntitlementPort, useExisting: EntitlementReaderPort },
  { provide: ReminderTimezoneCachePort, useExisting: NotificationReminderTimezoneCachePort },
] satisfies Provider[];

export const refreshPushTimezoneProvider = provideUseCase(RefreshPushTimezoneUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
});

export const updatePreferenceProvider = provideUseCase(UpdatePreferenceUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  mutationLock: MutationLockPort,
  entitlement: PreferenceEntitlementPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  reminderEnqueuer: ReminderScheduleEnqueuerPort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
  logger: loggerFor(UpdatePreferenceUseCase),
});

export const upsertPushTimezoneProvider = provideUseCase(UpsertPushTimezoneUseCase, {
  preferenceRepository: UserPreferenceRepositoryPort,
  mutationLock: MutationLockPort,
  cache: UserSettingsCachePort,
  reminderTimezoneCache: ReminderTimezoneCachePort,
  todoTimezoneRebase: TodoTimezoneRebaseEnqueuerPort,
  unitOfWork: UnitOfWorkPort,
  clock: ClockPort,
});

export const IDENTITY_USER_PREFERENCES_PROVIDERS = [
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
  provideUseCase(GetPreferenceReadModelUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
  }),
  provideUseCase(GetPreferenceReadModelsUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
  }),
  provideUseCase(GetConsentUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetConsentReadModelUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetConsentReadModelsUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(GetAiDataSharingConsentUseCase, { consentRepository: UserConsentRepositoryPort }),
  provideUseCase(OnTodoToggledUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    statsReader: TodoCompletionStatsReaderPort,
    milestoneNotifier: StreakMilestoneNotifierPort,
    clock: ClockPort,
    logger: loggerFor(OnTodoToggledUseCase),
  }),
  provideUseCase(SeedUserSettingsUseCase, { preferenceRepository: UserPreferenceRepositoryPort }),
  provideUseCase(UpdateAiDataSharingConsentUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(UpdateAiDataSharingConsentUseCase),
  }),
  provideUseCase(UpdateMarketingConsentUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(UpdateMarketingConsentUseCase),
  }),
  provideUseCase(UpdateMarketingPushConsentUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    clock: ClockPort,
    logger: loggerFor(UpdateMarketingPushConsentUseCase),
  }),
  provideUseCase(UpsertPushLocaleUseCase, {
    preferenceRepository: UserPreferenceRepositoryPort,
    mutationLock: MutationLockPort,
    unitOfWork: UnitOfWorkPort,
    cache: UserSettingsCachePort,
  }),
] satisfies Provider[];
