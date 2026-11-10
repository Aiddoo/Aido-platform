import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationQueueModule } from "#api/modules/notification/notification-delivery-jobs.public";
import { TimezoneReminderQueueModule } from "#api/modules/notification/notification-reminders-jobs.public";
import { TodoTimezoneRebaseQueueModule } from "#api/modules/planning/planning-todo-timezone-jobs.public";

import {
  AI_DATA_SHARING_CONSENT_READER,
  AiDataSharingConsentReaderPort,
} from "./application/ports/ai-data-sharing-consent.reader.port.js";
import {
  REMINDER_SCHEDULE_ENQUEUER,
  ReminderScheduleEnqueuerPort,
} from "./application/ports/reminder-schedule-enqueuer.port.js";
import {
  STREAK_MILESTONE_NOTIFIER,
  StreakMilestoneNotifierPort,
} from "./application/ports/streak-milestone-notifier.port.js";
import {
  TODO_COMPLETION_STATS_READER,
  TodoCompletionStatsReaderPort,
} from "./application/ports/todo-completion-stats.reader.port.js";
import {
  TODO_TIMEZONE_REBASE_ENQUEUER,
  TodoTimezoneRebaseEnqueuerPort,
} from "./application/ports/todo-timezone-rebase-enqueuer.port.js";
import {
  USER_CONSENT_REPOSITORY,
  UserConsentRepositoryPort,
} from "./application/ports/user-consent.repository.port.js";
import {
  USER_PREFERENCE_READER,
  UserPreferenceReaderPort,
} from "./application/ports/user-preference.reader.port.js";
import {
  USER_PREFERENCE_REPOSITORY,
  UserPreferenceRepositoryPort,
} from "./application/ports/user-preference.repository.port.js";
import {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  UserNotificationSettingsAccessPort,
  USER_SETTINGS_PROVISIONER,
  UserSettingsProvisionerPort,
  USER_STREAK_ACCESS,
  UserStreakAccessPort,
  USER_TIMEZONE_READER,
  UserTimezoneReaderPort,
} from "./application/ports/user-settings-access.port.js";
import {
  USER_SETTINGS_CACHE,
  UserSettingsCachePort,
} from "./application/ports/user-settings-cache.port.js";
import { GetAiDataSharingConsentUseCase } from "./application/use-cases/get-ai-data-sharing-consent.use-case.js";
import { ReadUserPreferencesUseCase } from "./application/use-cases/read-user-preferences.use-case.js";
import { IDENTITY_PREFERENCES_PROVIDERS } from "./identity-preferences.providers.js";
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
    ...IDENTITY_PREFERENCES_PROVIDERS,
    UserSettingsAccessAdapter,
    { provide: UserPreferenceReaderPort, useExisting: ReadUserPreferencesUseCase },
    { provide: USER_PREFERENCE_READER, useExisting: UserPreferenceReaderPort },
    { provide: AiDataSharingConsentReaderPort, useExisting: GetAiDataSharingConsentUseCase },
    { provide: AI_DATA_SHARING_CONSENT_READER, useExisting: AiDataSharingConsentReaderPort },
    TimezoneSelfHealInterceptor,
    DrizzleUserPreferenceRepository,
    DrizzleUserConsentRepository,
    DrizzleTodoCompletionStatsReader,
    { provide: UserPreferenceRepositoryPort, useExisting: DrizzleUserPreferenceRepository },
    { provide: USER_PREFERENCE_REPOSITORY, useExisting: UserPreferenceRepositoryPort },
    { provide: UserConsentRepositoryPort, useExisting: DrizzleUserConsentRepository },
    { provide: USER_CONSENT_REPOSITORY, useExisting: UserConsentRepositoryPort },
    { provide: TodoCompletionStatsReaderPort, useExisting: DrizzleTodoCompletionStatsReader },
    { provide: TODO_COMPLETION_STATS_READER, useExisting: TodoCompletionStatsReaderPort },
    { provide: ReminderScheduleEnqueuerPort, useClass: TimezoneReminderEnqueuerAdapter },
    { provide: REMINDER_SCHEDULE_ENQUEUER, useExisting: ReminderScheduleEnqueuerPort },
    { provide: TodoTimezoneRebaseEnqueuerPort, useClass: TodoTimezoneRebaseEnqueuerAdapter },
    { provide: TODO_TIMEZONE_REBASE_ENQUEUER, useExisting: TodoTimezoneRebaseEnqueuerPort },
    { provide: StreakMilestoneNotifierPort, useClass: StreakMilestoneNotifierAdapter },
    { provide: STREAK_MILESTONE_NOTIFIER, useExisting: StreakMilestoneNotifierPort },
    { provide: UserSettingsCachePort, useClass: UserSettingsCacheAdapter },
    { provide: USER_SETTINGS_CACHE, useExisting: UserSettingsCachePort },
    { provide: UserSettingsProvisionerPort, useExisting: UserSettingsAccessAdapter },
    { provide: USER_SETTINGS_PROVISIONER, useExisting: UserSettingsProvisionerPort },
    { provide: UserStreakAccessPort, useExisting: UserSettingsAccessAdapter },
    { provide: USER_STREAK_ACCESS, useExisting: UserStreakAccessPort },
    { provide: UserTimezoneReaderPort, useExisting: UserSettingsAccessAdapter },
    { provide: USER_TIMEZONE_READER, useExisting: UserTimezoneReaderPort },
    { provide: UserNotificationSettingsAccessPort, useExisting: UserSettingsAccessAdapter },
    { provide: USER_NOTIFICATION_SETTINGS_ACCESS, useExisting: UserNotificationSettingsAccessPort },
  ],
  exports: [
    UserSettingsCachePort,
    USER_SETTINGS_CACHE,
    UserPreferenceReaderPort,
    USER_PREFERENCE_READER,
    UserSettingsProvisionerPort,
    USER_SETTINGS_PROVISIONER,
    UserStreakAccessPort,
    USER_STREAK_ACCESS,
    UserTimezoneReaderPort,
    USER_TIMEZONE_READER,
    UserNotificationSettingsAccessPort,
    USER_NOTIFICATION_SETTINGS_ACCESS,
    AiDataSharingConsentReaderPort,
    AI_DATA_SHARING_CONSENT_READER,
    TimezoneSelfHealInterceptor,
  ],
})
export class IdentityPreferencesModule {}
