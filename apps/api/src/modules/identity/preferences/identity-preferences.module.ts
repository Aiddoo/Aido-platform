import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { NotificationQueueModule } from "#api/modules/notification/notification-delivery-jobs.public";
import { TimezoneReminderQueueModule } from "#api/modules/notification/notification-reminders-jobs.public";
import { TodoTimezoneRebaseQueueModule } from "#api/modules/planning/todos/planning-todo-timezone-jobs.public";

import { AiDataSharingConsentReaderPort } from "./application/ports/ai-data-sharing-consent.reader.port.js";
import { ReminderScheduleEnqueuerPort } from "./application/ports/reminder-schedule-enqueuer.port.js";
import { StreakMilestoneNotifierPort } from "./application/ports/streak-milestone-notifier.port.js";
import { TodoCompletionStatsReaderPort } from "./application/ports/todo-completion-stats.reader.port.js";
import { TodoTimezoneRebaseEnqueuerPort } from "./application/ports/todo-timezone-rebase-enqueuer.port.js";
import { UserConsentRepositoryPort } from "./application/ports/user-consent.repository.port.js";
import { UserPreferenceReaderPort } from "./application/ports/user-preference.reader.port.js";
import { UserPreferenceRepositoryPort } from "./application/ports/user-preference.repository.port.js";
import {
  UserNotificationSettingsAccessPort,
  UserSettingsProvisionerPort,
  UserStreakAccessPort,
  UserTimezoneReaderPort,
} from "./application/ports/user-settings-access.port.js";
import { UserSettingsCachePort } from "./application/ports/user-settings-cache.port.js";
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
    AccessEntitlementsModule,
    NotificationQueueModule,
    TimezoneReminderQueueModule,
    TodoTimezoneRebaseQueueModule,
  ],
  controllers: [SettingsController],
  providers: [
    ...IDENTITY_PREFERENCES_PROVIDERS,
    UserSettingsAccessAdapter,
    { provide: UserPreferenceReaderPort, useExisting: ReadUserPreferencesUseCase },
    { provide: AiDataSharingConsentReaderPort, useExisting: GetAiDataSharingConsentUseCase },
    TimezoneSelfHealInterceptor,
    DrizzleUserPreferenceRepository,
    DrizzleUserConsentRepository,
    DrizzleTodoCompletionStatsReader,
    { provide: UserPreferenceRepositoryPort, useExisting: DrizzleUserPreferenceRepository },
    { provide: UserConsentRepositoryPort, useExisting: DrizzleUserConsentRepository },
    { provide: TodoCompletionStatsReaderPort, useExisting: DrizzleTodoCompletionStatsReader },
    { provide: ReminderScheduleEnqueuerPort, useClass: TimezoneReminderEnqueuerAdapter },
    { provide: TodoTimezoneRebaseEnqueuerPort, useClass: TodoTimezoneRebaseEnqueuerAdapter },
    { provide: StreakMilestoneNotifierPort, useClass: StreakMilestoneNotifierAdapter },
    { provide: UserSettingsCachePort, useClass: UserSettingsCacheAdapter },
    { provide: UserSettingsProvisionerPort, useExisting: UserSettingsAccessAdapter },
    { provide: UserStreakAccessPort, useExisting: UserSettingsAccessAdapter },
    { provide: UserTimezoneReaderPort, useExisting: UserSettingsAccessAdapter },
    { provide: UserNotificationSettingsAccessPort, useExisting: UserSettingsAccessAdapter },
  ],
  exports: [
    UserSettingsCachePort,
    UserPreferenceReaderPort,
    UserSettingsProvisionerPort,
    UserStreakAccessPort,
    UserTimezoneReaderPort,
    UserNotificationSettingsAccessPort,
    AiDataSharingConsentReaderPort,
    TimezoneSelfHealInterceptor,
  ],
})
export class IdentityPreferencesModule {}
