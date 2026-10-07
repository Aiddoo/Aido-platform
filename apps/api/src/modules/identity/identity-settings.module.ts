import { Module } from "@nestjs/common";

import {
  EntitlementModule,
  EntitlementService,
} from "#api/modules/access/access-entitlement.public";
import { NotificationQueueModule } from "#api/modules/notification/notification-delivery-jobs.public";
import { TimezoneReminderQueueModule } from "#api/modules/notification/notification-reminders-jobs.public";

import { PREFERENCE_ENTITLEMENT } from "./application/ports/settings/preference-entitlement.port.js";
import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/settings/reminder-schedule.enqueuer.port.js";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/settings/streak-milestone.notifier.port.js";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/settings/todo-completion-stats.reader.port.js";
import { USER_CONSENT_REPOSITORY } from "./application/ports/settings/user-consent.repository.port.js";
import { USER_PREFERENCE_READER } from "./application/ports/settings/user-preference.reader.port.js";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/settings/user-preference.repository.port.js";
import {
  USER_NOTIFICATION_SETTINGS_ACCESS,
  USER_SETTINGS_PROVISIONER,
  USER_STREAK_ACCESS,
} from "./application/ports/settings/user-settings-access.port.js";
import { USER_SETTINGS_CACHE } from "./application/ports/settings/user-settings-cache.port.js";
import { UserPreferenceReader } from "./application/services/settings/user-preference-reader.service.js";
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
  updateMarketingConsentProvider,
  updateMarketingPushConsentProvider,
  updatePreferenceProvider,
  upsertPushLocaleProvider,
  upsertPushTimezoneProvider,
} from "./identity-settings-application.providers.js";
import { StreakMilestoneNotifierAdapter } from "./infrastructure/adapters/settings/streak-milestone-notifier.adapter.js";
import { TimezoneReminderEnqueuerAdapter } from "./infrastructure/adapters/settings/timezone-reminder-enqueuer.adapter.js";
import { UserSettingsAccessAdapter } from "./infrastructure/adapters/settings/user-settings-access.adapter.js";
import { UserSettingsCacheAdapter } from "./infrastructure/adapters/settings/user-settings-cache.adapter.js";
import { PrismaTodoCompletionStatsReader } from "./infrastructure/persistence/settings/prisma-todo-completion-stats.reader.js";
import { UserConsentRepository } from "./infrastructure/persistence/settings/user-consent.repository.js";
import { UserPreferenceRepository } from "./infrastructure/persistence/settings/user-preference.repository.js";
import { SettingsController } from "./presentation/controllers/settings/user-settings.controller.js";
import { TimezoneSelfHealInterceptor } from "./presentation/interceptors/settings/timezone-self-heal.interceptor.js";

@Module({
  imports: [EntitlementModule, NotificationQueueModule, TimezoneReminderQueueModule],
  controllers: [SettingsController],
  providers: [
    UserSettingsAccessAdapter,
    userPreferenceReaderProvider,
    { provide: USER_PREFERENCE_READER, useExisting: UserPreferenceReader },
    { provide: PREFERENCE_ENTITLEMENT, useExisting: EntitlementService },
    getPreferenceProvider,
    updatePreferenceProvider,
    getConsentProvider,
    updateMarketingConsentProvider,
    updateMarketingPushConsentProvider,
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
    USER_PREFERENCE_READER,
    USER_SETTINGS_PROVISIONER,
    USER_STREAK_ACCESS,
    USER_NOTIFICATION_SETTINGS_ACCESS,
    TimezoneSelfHealInterceptor,
  ],
})
export class UserSettingsModule {}
