import { Module } from "@nestjs/common";

import { AccessModule, ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { NotificationQueueModule } from "#api/modules/notification/notification-delivery-jobs.public";
import { TimezoneReminderQueueModule } from "#api/modules/notification/notification-reminders-jobs.public";
import { TodoTimezoneRebaseQueueModule } from "#api/modules/planning/planning-todo-timezone-jobs.public";

import { AI_DATA_SHARING_CONSENT_READER } from "./application/ports/ai-data-sharing-consent.reader.port.js";
import { PREFERENCE_ENTITLEMENT } from "./application/ports/preference-entitlement.port.js";
import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/reminder-schedule-enqueuer.port.js";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/streak-milestone-notifier.port.js";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/todo-completion-stats.reader.port.js";
import { TODO_TIMEZONE_REBASE_ENQUEUER } from "./application/ports/todo-timezone-rebase-enqueuer.port.js";
import { USER_CONSENT_REPOSITORY } from "./application/ports/user-consent.repository.port.js";
import { USER_PREFERENCE_READER } from "./application/ports/user-preference.reader.port.js";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/user-preference.repository.port.js";
import {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  USER_SETTINGS_PROVISIONER,
  USER_STREAK_ACCESS,
  USER_TIMEZONE_READER,
} from "./application/ports/user-settings-access.port.js";
import { USER_SETTINGS_CACHE } from "./application/ports/user-settings-cache.port.js";
import { AiDataSharingConsentReader } from "./application/use-cases/get-ai-data-sharing-consent.use-case.js";
import { UserPreferenceReader } from "./application/use-cases/read-user-preferences.use-case.js";
import {
  userPreferenceReaderProvider,
  getConsentRecordsProvider,
  getConsentRecordProvider,
  getConsentProvider,
  getPreferenceRecordsProvider,
  getPreferenceRecordProvider,
  getPreferenceProvider,
  onTodoToggledProvider,
  refreshPushTimezoneProvider,
  seedUserSettingsProvider,
  aiDataSharingConsentReaderProvider,
  updateAiDataSharingConsentProvider,
  updateMarketingConsentProvider,
  updateMarketingPushConsentProvider,
  updatePreferenceProvider,
  upsertPushLocaleProvider,
  upsertPushTimezoneProvider,
} from "./identity-preferences.providers.js";
import { StreakMilestoneNotifierAdapter } from "./infrastructure/adapters/streak-milestone-notifier.adapter.js";
import { TimezoneReminderEnqueuerAdapter } from "./infrastructure/adapters/timezone-reminder-enqueuer.adapter.js";
import { TodoTimezoneRebaseEnqueuerAdapter } from "./infrastructure/adapters/todo-timezone-rebase-enqueuer.adapter.js";
import { UserSettingsAccessAdapter } from "./infrastructure/adapters/user-settings-access.adapter.js";
import { UserSettingsCacheAdapter } from "./infrastructure/adapters/user-settings-cache.adapter.js";
import { DrizzleTodoCompletionStatsReader } from "./infrastructure/persistence/drizzle-todo-completion-stats.reader.js";
import { DrizzleUserConsentRepository } from "./infrastructure/persistence/drizzle-user-consent.repository.js";
import { DrizzleUserPreferenceRepository } from "./infrastructure/persistence/drizzle-user-preference.repository.js";
import { TimezoneSelfHealInterceptor } from "./presentation/http/interceptors/timezone-self-heal.interceptor.js";
import { SettingsController } from "./presentation/http/v1/user-settings.controller.js";

@Module({
  imports: [
    AccessModule,
    NotificationQueueModule,
    TimezoneReminderQueueModule,
    TodoTimezoneRebaseQueueModule,
  ],
  controllers: [SettingsController],
  providers: [
    UserSettingsAccessAdapter,
    userPreferenceReaderProvider,
    { provide: USER_PREFERENCE_READER, useExisting: UserPreferenceReader },
    { provide: PREFERENCE_ENTITLEMENT, useExisting: ENTITLEMENT_READER },
    getPreferenceProvider,
    updatePreferenceProvider,
    getConsentProvider,
    updateMarketingConsentProvider,
    updateMarketingPushConsentProvider,
    updateAiDataSharingConsentProvider,
    aiDataSharingConsentReaderProvider,
    { provide: AI_DATA_SHARING_CONSENT_READER, useExisting: AiDataSharingConsentReader },
    onTodoToggledProvider,
    seedUserSettingsProvider,
    upsertPushTimezoneProvider,
    refreshPushTimezoneProvider,
    upsertPushLocaleProvider,
    TimezoneSelfHealInterceptor,
    getPreferenceRecordProvider,
    getPreferenceRecordsProvider,
    getConsentRecordProvider,
    getConsentRecordsProvider,
    DrizzleUserPreferenceRepository,
    DrizzleUserConsentRepository,
    DrizzleTodoCompletionStatsReader,
    {
      provide: USER_PREFERENCE_REPOSITORY,
      useExisting: DrizzleUserPreferenceRepository,
    },
    { provide: USER_CONSENT_REPOSITORY, useExisting: DrizzleUserConsentRepository },
    {
      provide: TODO_COMPLETION_STATS_READER,
      useExisting: DrizzleTodoCompletionStatsReader,
    },
    {
      provide: REMINDER_SCHEDULE_ENQUEUER,
      useClass: TimezoneReminderEnqueuerAdapter,
    },
    {
      provide: TODO_TIMEZONE_REBASE_ENQUEUER,
      useClass: TodoTimezoneRebaseEnqueuerAdapter,
    },
    {
      provide: STREAK_MILESTONE_NOTIFIER,
      useClass: StreakMilestoneNotifierAdapter,
    },
    { provide: USER_SETTINGS_CACHE, useClass: UserSettingsCacheAdapter },
    {
      provide: USER_SETTINGS_PROVISIONER,
      useExisting: UserSettingsAccessAdapter,
    },
    { provide: USER_STREAK_ACCESS, useExisting: UserSettingsAccessAdapter },
    { provide: USER_TIMEZONE_READER, useExisting: UserSettingsAccessAdapter },
    {
      provide: USER_NOTIFICATION_SETTINGS_ACCESS,
      useExisting: UserSettingsAccessAdapter,
    },
  ],
  exports: [
    USER_SETTINGS_CACHE,
    USER_PREFERENCE_READER,
    USER_SETTINGS_PROVISIONER,
    USER_STREAK_ACCESS,
    USER_TIMEZONE_READER,
    USER_NOTIFICATION_SETTINGS_ACCESS,
    AI_DATA_SHARING_CONSENT_READER,
    TimezoneSelfHealInterceptor,
  ],
})
export class IdentitySettingsModule {}
