import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "@/notification/queue";
import { TimezoneReminderQueueModule } from "@/scheduler/queue";

import { UserSettingsFacade } from "./application/facades/user-settings.facade";
import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/reminder-schedule.enqueuer.port";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/streak-milestone.notifier.port";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/todo-completion-stats.reader.port";
import { USER_CONSENT_REPOSITORY } from "./application/ports/user-consent.repository.port";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/user-preference.repository.port";
import { USER_SETTINGS_CACHE } from "./application/ports/user-settings-cache.port";
import { GetConsentUseCase } from "./application/use-cases/get-consent/get-consent.use-case";
import { GetConsentRecordUseCase } from "./application/use-cases/get-consent-record/get-consent-record.use-case";
import { GetConsentRecordsUseCase } from "./application/use-cases/get-consent-records/get-consent-records.use-case";
import { GetPreferenceUseCase } from "./application/use-cases/get-preference/get-preference.use-case";
import { GetPreferenceRecordUseCase } from "./application/use-cases/get-preference-record/get-preference-record.use-case";
import { GetPreferenceRecordsUseCase } from "./application/use-cases/get-preference-records/get-preference-records.use-case";
import { OnTodoToggledUseCase } from "./application/use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { RefreshPushTimezoneUseCase } from "./application/use-cases/refresh-push-timezone/refresh-push-timezone.use-case";
import { SeedUserSettingsUseCase } from "./application/use-cases/seed-user-settings/seed-user-settings.use-case";
import { UpdateMarketingConsentUseCase } from "./application/use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdateMarketingPushConsentUseCase } from "./application/use-cases/update-marketing-push-consent/update-marketing-push-consent.use-case";
import { UpdatePreferenceUseCase } from "./application/use-cases/update-preference/update-preference.use-case";
import { UpsertPushLocaleUseCase } from "./application/use-cases/upsert-push-locale/upsert-push-locale.use-case";
import { UpsertPushTimezoneUseCase } from "./application/use-cases/upsert-push-timezone/upsert-push-timezone.use-case";
import { StreakMilestoneNotifierAdapter } from "./infrastructure/adapters/streak-milestone-notifier.adapter";
import { TimezoneReminderEnqueuerAdapter } from "./infrastructure/adapters/timezone-reminder-enqueuer.adapter";
import { UserSettingsCacheAdapter } from "./infrastructure/adapters/user-settings-cache.adapter";
import { PrismaTodoCompletionStatsReader } from "./infrastructure/persistence/prisma-todo-completion-stats.reader";
import { UserConsentRepository } from "./infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "./infrastructure/persistence/user-preference.repository";
import { TimezoneSelfHealInterceptor } from "./presentation/interceptors/timezone-self-heal.interceptor";
import { SettingsController } from "./presentation/user-settings.controller";

@Module({
	imports: [NotificationQueueModule, TimezoneReminderQueueModule],
	controllers: [SettingsController],
	providers: [
		UserSettingsFacade,
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
	],
	exports: [UserSettingsFacade, TimezoneSelfHealInterceptor],
})
export class UserSettingsModule {}
