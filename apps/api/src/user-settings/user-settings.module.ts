import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "#api/notification/queue";
import { TimezoneReminderQueueModule } from "#api/scheduler/queue";

import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/reminder-schedule.enqueuer.port.js";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/streak-milestone.notifier.port.js";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/todo-completion-stats.reader.port.js";
import { USER_CONSENT_REPOSITORY } from "./application/ports/user-consent.repository.port.js";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/user-preference.repository.port.js";
import {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  USER_SETTINGS_PROVISIONER,
  USER_STREAK_ACCESS,
} from "./application/ports/user-settings-access.port.js";
import { USER_SETTINGS_CACHE } from "./application/ports/user-settings-cache.port.js";
import { GetConsentRecordUseCase } from "./application/use-cases/get-consent-record/get-consent-record.use-case.js";
import { GetConsentRecordsUseCase } from "./application/use-cases/get-consent-records/get-consent-records.use-case.js";
import { GetConsentUseCase } from "./application/use-cases/get-consent/get-consent.use-case.js";
import { GetPreferenceRecordUseCase } from "./application/use-cases/get-preference-record/get-preference-record.use-case.js";
import { GetPreferenceRecordsUseCase } from "./application/use-cases/get-preference-records/get-preference-records.use-case.js";
import { GetPreferenceUseCase } from "./application/use-cases/get-preference/get-preference.use-case.js";
import { OnTodoToggledUseCase } from "./application/use-cases/on-todo-toggled/on-todo-toggled.use-case.js";
import { RefreshPushTimezoneUseCase } from "./application/use-cases/refresh-push-timezone/refresh-push-timezone.use-case.js";
import { SeedUserSettingsUseCase } from "./application/use-cases/seed-user-settings/seed-user-settings.use-case.js";
import { UpdateMarketingConsentUseCase } from "./application/use-cases/update-marketing-consent/update-marketing-consent.use-case.js";
import { UpdateMarketingPushConsentUseCase } from "./application/use-cases/update-marketing-push-consent/update-marketing-push-consent.use-case.js";
import { UpdatePreferenceUseCase } from "./application/use-cases/update-preference/update-preference.use-case.js";
import { UpsertPushLocaleUseCase } from "./application/use-cases/upsert-push-locale/upsert-push-locale.use-case.js";
import { UpsertPushTimezoneUseCase } from "./application/use-cases/upsert-push-timezone/upsert-push-timezone.use-case.js";
import { StreakMilestoneNotifierAdapter } from "./infrastructure/adapters/streak-milestone-notifier.adapter.js";
import { TimezoneReminderEnqueuerAdapter } from "./infrastructure/adapters/timezone-reminder-enqueuer.adapter.js";
import { UserSettingsAccessAdapter } from "./infrastructure/adapters/user-settings-access.adapter.js";
import { UserSettingsCacheAdapter } from "./infrastructure/adapters/user-settings-cache.adapter.js";
import { PrismaTodoCompletionStatsReader } from "./infrastructure/persistence/prisma-todo-completion-stats.reader.js";
import { UserConsentRepository } from "./infrastructure/persistence/user-consent.repository.js";
import { UserPreferenceRepository } from "./infrastructure/persistence/user-preference.repository.js";
import { TimezoneSelfHealInterceptor } from "./presentation/interceptors/timezone-self-heal.interceptor.js";
import { SettingsController } from "./presentation/user-settings.controller.js";

@Module({
  imports: [NotificationQueueModule, TimezoneReminderQueueModule],
  controllers: [SettingsController],
  providers: [
    UserSettingsAccessAdapter,
    GetPreferenceUseCase,
    UpdatePreferenceUseCase,
    GetConsentUseCase,
    UpdateMarketingConsentUseCase,
    UpdateMarketingPushConsentUseCase,
    OnTodoToggledUseCase,
    SeedUserSettingsUseCase,
    UpsertPushTimezoneUseCase,
    RefreshPushTimezoneUseCase,
    UpsertPushLocaleUseCase,
    TimezoneSelfHealInterceptor,
    GetPreferenceRecordUseCase,
    GetPreferenceRecordsUseCase,
    GetConsentRecordUseCase,
    GetConsentRecordsUseCase,
    UserPreferenceRepository,
    UserConsentRepository,
    PrismaTodoCompletionStatsReader,
    {
      provide: USER_PREFERENCE_REPOSITORY,
      useExisting: UserPreferenceRepository,
    },
    { provide: USER_CONSENT_REPOSITORY, useExisting: UserConsentRepository },
    {
      provide: TODO_COMPLETION_STATS_READER,
      useExisting: PrismaTodoCompletionStatsReader,
    },
    {
      provide: REMINDER_SCHEDULE_ENQUEUER,
      useClass: TimezoneReminderEnqueuerAdapter,
    },
    {
      provide: STREAK_MILESTONE_NOTIFIER,
      useClass: StreakMilestoneNotifierAdapter,
    },
    // 조회 캐시 포트 (application → CacheService 직접 의존 역전)
    { provide: USER_SETTINGS_CACHE, useClass: UserSettingsCacheAdapter },
    {
      provide: USER_SETTINGS_PROVISIONER,
      useExisting: UserSettingsAccessAdapter,
    },
    { provide: USER_STREAK_ACCESS, useExisting: UserSettingsAccessAdapter },
    {
      provide: USER_NOTIFICATION_SETTINGS_ACCESS,
      useExisting: UserSettingsAccessAdapter,
    },
  ],
  exports: [
    USER_SETTINGS_PROVISIONER,
    USER_STREAK_ACCESS,
    USER_NOTIFICATION_SETTINGS_ACCESS,
    TimezoneSelfHealInterceptor,
  ],
})
export class UserSettingsModule {}
