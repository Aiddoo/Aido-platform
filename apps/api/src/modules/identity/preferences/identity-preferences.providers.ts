import { Logger, type FactoryProvider } from "@nestjs/common";

import { REMINDER_TIMEZONE_CACHE } from "#api/modules/notification/notification-reminders-cache.public";
import { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { PREFERENCE_ENTITLEMENT } from "./application/ports/preference-entitlement.port.js";
import { ReminderScheduleEnqueuerPort } from "./application/ports/reminder-schedule-enqueuer.port.js";
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

export const userPreferenceReaderProvider: FactoryProvider<ReadUserPreferencesUseCase> = {
  provide: ReadUserPreferencesUseCase,
  inject: [UserPreferenceRepositoryPort, UserSettingsCachePort],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof ReadUserPreferencesUseCase
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof ReadUserPreferencesUseCase>[0]["cache"],
  ) => new ReadUserPreferencesUseCase({ preferenceRepository, cache }),
};

export const getConsentProvider: FactoryProvider<GetConsentUseCase> = {
  provide: GetConsentUseCase,
  inject: [UserConsentRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<typeof GetConsentUseCase>[0]["consentRepository"],
  ) => new GetConsentUseCase({ consentRepository }),
};

export const getConsentRecordProvider: FactoryProvider<GetConsentRecordUseCase> = {
  provide: GetConsentRecordUseCase,
  inject: [UserConsentRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof GetConsentRecordUseCase
    >[0]["consentRepository"],
  ) => new GetConsentRecordUseCase({ consentRepository }),
};

export const getConsentRecordsProvider: FactoryProvider<GetConsentRecordsUseCase> = {
  provide: GetConsentRecordsUseCase,
  inject: [UserConsentRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof GetConsentRecordsUseCase
    >[0]["consentRepository"],
  ) => new GetConsentRecordsUseCase({ consentRepository }),
};

export const getPreferenceProvider: FactoryProvider<GetPreferenceUseCase> = {
  provide: GetPreferenceUseCase,
  inject: [ReadUserPreferencesUseCase, PREFERENCE_ENTITLEMENT],
  useFactory: (
    preferenceReader: ConstructorParameters<typeof GetPreferenceUseCase>[0]["preferenceReader"],
    entitlement: ConstructorParameters<typeof GetPreferenceUseCase>[0]["entitlement"],
  ) => new GetPreferenceUseCase({ preferenceReader, entitlement }),
};

export const getPreferenceRecordProvider: FactoryProvider<GetPreferenceRecordUseCase> = {
  provide: GetPreferenceRecordUseCase,
  inject: [UserPreferenceRepositoryPort],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof GetPreferenceRecordUseCase
    >[0]["preferenceRepository"],
  ) => new GetPreferenceRecordUseCase({ preferenceRepository }),
};

export const getPreferenceRecordsProvider: FactoryProvider<GetPreferenceRecordsUseCase> = {
  provide: GetPreferenceRecordsUseCase,
  inject: [UserPreferenceRepositoryPort],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof GetPreferenceRecordsUseCase
    >[0]["preferenceRepository"],
  ) => new GetPreferenceRecordsUseCase({ preferenceRepository }),
};

export const onTodoToggledProvider: FactoryProvider<OnTodoToggledUseCase> = {
  provide: OnTodoToggledUseCase,
  inject: [
    UserPreferenceRepositoryPort,
    TodoCompletionStatsReaderPort,
    StreakMilestoneNotifierPort,
  ],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof OnTodoToggledUseCase
    >[0]["preferenceRepository"],
    statsReader: ConstructorParameters<typeof OnTodoToggledUseCase>[0]["statsReader"],
    milestoneNotifier: ConstructorParameters<typeof OnTodoToggledUseCase>[0]["milestoneNotifier"],
  ) =>
    new OnTodoToggledUseCase({
      preferenceRepository,
      statsReader,
      milestoneNotifier,
      logger: new Logger(OnTodoToggledUseCase.name),
    }),
};

export const refreshPushTimezoneProvider: FactoryProvider<RefreshPushTimezoneUseCase> = {
  provide: RefreshPushTimezoneUseCase,
  inject: [
    UserPreferenceRepositoryPort,
    UserSettingsCachePort,
    REMINDER_TIMEZONE_CACHE,
    TodoTimezoneRebaseEnqueuerPort,
    UnitOfWorkPort,
  ],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof RefreshPushTimezoneUseCase
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof RefreshPushTimezoneUseCase>[0]["cache"],
    reminderTimezoneCache: ConstructorParameters<
      typeof RefreshPushTimezoneUseCase
    >[0]["reminderTimezoneCache"],
    todoTimezoneRebase: ConstructorParameters<
      typeof RefreshPushTimezoneUseCase
    >[0]["todoTimezoneRebase"],
    unitOfWork: ConstructorParameters<typeof RefreshPushTimezoneUseCase>[0]["unitOfWork"],
  ) =>
    new RefreshPushTimezoneUseCase({
      preferenceRepository,
      cache,
      reminderTimezoneCache,
      todoTimezoneRebase,
      unitOfWork,
    }),
};

export const seedUserSettingsProvider: FactoryProvider<SeedUserSettingsUseCase> = {
  provide: SeedUserSettingsUseCase,
  inject: [UserConsentRepositoryPort, UserPreferenceRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof SeedUserSettingsUseCase
    >[0]["consentRepository"],
    preferenceRepository: ConstructorParameters<
      typeof SeedUserSettingsUseCase
    >[0]["preferenceRepository"],
  ) =>
    new SeedUserSettingsUseCase({
      consentRepository,
      preferenceRepository,
    }),
};

export const aiDataSharingConsentReaderProvider: FactoryProvider<GetAiDataSharingConsentUseCase> = {
  provide: GetAiDataSharingConsentUseCase,
  inject: [UserConsentRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof GetAiDataSharingConsentUseCase
    >[0]["consentRepository"],
  ) => new GetAiDataSharingConsentUseCase({ consentRepository }),
};

export const updateAiDataSharingConsentProvider: FactoryProvider<UpdateAiDataSharingConsentUseCase> =
  {
    provide: UpdateAiDataSharingConsentUseCase,
    inject: [UserConsentRepositoryPort],
    useFactory: (
      consentRepository: ConstructorParameters<
        typeof UpdateAiDataSharingConsentUseCase
      >[0]["consentRepository"],
    ) =>
      new UpdateAiDataSharingConsentUseCase({
        consentRepository,
        logger: new Logger(UpdateAiDataSharingConsentUseCase.name),
      }),
  };

export const updateMarketingConsentProvider: FactoryProvider<UpdateMarketingConsentUseCase> = {
  provide: UpdateMarketingConsentUseCase,
  inject: [UserConsentRepositoryPort],
  useFactory: (
    consentRepository: ConstructorParameters<
      typeof UpdateMarketingConsentUseCase
    >[0]["consentRepository"],
  ) =>
    new UpdateMarketingConsentUseCase({
      consentRepository,
      logger: new Logger(UpdateMarketingConsentUseCase.name),
    }),
};

export const updateMarketingPushConsentProvider: FactoryProvider<UpdateMarketingPushConsentUseCase> =
  {
    provide: UpdateMarketingPushConsentUseCase,
    inject: [UserConsentRepositoryPort],
    useFactory: (
      consentRepository: ConstructorParameters<
        typeof UpdateMarketingPushConsentUseCase
      >[0]["consentRepository"],
    ) =>
      new UpdateMarketingPushConsentUseCase({
        consentRepository,
        logger: new Logger(UpdateMarketingPushConsentUseCase.name),
      }),
  };

export const updatePreferenceProvider: FactoryProvider<UpdatePreferenceUseCase> = {
  provide: UpdatePreferenceUseCase,
  inject: [
    UserPreferenceRepositoryPort,
    PREFERENCE_ENTITLEMENT,
    UserSettingsCachePort,
    REMINDER_TIMEZONE_CACHE,
    ReminderScheduleEnqueuerPort,
    TodoTimezoneRebaseEnqueuerPort,
    UnitOfWorkPort,
  ],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof UpdatePreferenceUseCase
    >[0]["preferenceRepository"],
    entitlement: ConstructorParameters<typeof UpdatePreferenceUseCase>[0]["entitlement"],
    cache: ConstructorParameters<typeof UpdatePreferenceUseCase>[0]["cache"],
    reminderTimezoneCache: ConstructorParameters<
      typeof UpdatePreferenceUseCase
    >[0]["reminderTimezoneCache"],
    reminderEnqueuer: ConstructorParameters<typeof UpdatePreferenceUseCase>[0]["reminderEnqueuer"],
    todoTimezoneRebase: ConstructorParameters<
      typeof UpdatePreferenceUseCase
    >[0]["todoTimezoneRebase"],
    unitOfWork: ConstructorParameters<typeof UpdatePreferenceUseCase>[0]["unitOfWork"],
  ) =>
    new UpdatePreferenceUseCase({
      preferenceRepository,
      entitlement,
      cache,
      reminderTimezoneCache,
      reminderEnqueuer,
      todoTimezoneRebase,
      unitOfWork,
      logger: new Logger(UpdatePreferenceUseCase.name),
    }),
};

export const upsertPushLocaleProvider: FactoryProvider<UpsertPushLocaleUseCase> = {
  provide: UpsertPushLocaleUseCase,
  inject: [UserPreferenceRepositoryPort, UserSettingsCachePort],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof UpsertPushLocaleUseCase
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof UpsertPushLocaleUseCase>[0]["cache"],
  ) => new UpsertPushLocaleUseCase({ preferenceRepository, cache }),
};

export const upsertPushTimezoneProvider: FactoryProvider<UpsertPushTimezoneUseCase> = {
  provide: UpsertPushTimezoneUseCase,
  inject: [
    UserPreferenceRepositoryPort,
    UserSettingsCachePort,
    REMINDER_TIMEZONE_CACHE,
    TodoTimezoneRebaseEnqueuerPort,
    UnitOfWorkPort,
  ],
  useFactory: (
    preferenceRepository: ConstructorParameters<
      typeof UpsertPushTimezoneUseCase
    >[0]["preferenceRepository"],
    cache: ConstructorParameters<typeof UpsertPushTimezoneUseCase>[0]["cache"],
    reminderTimezoneCache: ConstructorParameters<
      typeof UpsertPushTimezoneUseCase
    >[0]["reminderTimezoneCache"],
    todoTimezoneRebase: ConstructorParameters<
      typeof UpsertPushTimezoneUseCase
    >[0]["todoTimezoneRebase"],
    unitOfWork: ConstructorParameters<typeof UpsertPushTimezoneUseCase>[0]["unitOfWork"],
  ) =>
    new UpsertPushTimezoneUseCase({
      preferenceRepository,
      cache,
      reminderTimezoneCache,
      todoTimezoneRebase,
      unitOfWork,
    }),
};
