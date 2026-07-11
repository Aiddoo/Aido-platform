import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "@/notification/queue";
import { TimezoneReminderQueueModule } from "@/scheduler/queue/timezone-reminder-queue.module";

import { UserSettingsFacade } from "./application/facades/user-settings.facade";
import { REMINDER_SCHEDULE_ENQUEUER } from "./application/ports/reminder-schedule.enqueuer.port";
import { STREAK_MILESTONE_NOTIFIER } from "./application/ports/streak-milestone.notifier.port";
import { TODO_COMPLETION_STATS_READER } from "./application/ports/todo-completion-stats.reader.port";
import { USER_CONSENT_REPOSITORY } from "./application/ports/user-consent.repository.port";
import { USER_PREFERENCE_REPOSITORY } from "./application/ports/user-preference.repository.port";
import { GetConsentUseCase } from "./application/use-cases/get-consent/get-consent.use-case";
import { GetPreferenceUseCase } from "./application/use-cases/get-preference/get-preference.use-case";
import { OnTodoToggledUseCase } from "./application/use-cases/on-todo-toggled/on-todo-toggled.use-case";
import { UpdateMarketingConsentUseCase } from "./application/use-cases/update-marketing-consent/update-marketing-consent.use-case";
import { UpdatePreferenceUseCase } from "./application/use-cases/update-preference/update-preference.use-case";
import { StreakMilestoneNotifierAdapter } from "./infrastructure/adapters/streak-milestone-notifier.adapter";
import { TimezoneReminderEnqueuerAdapter } from "./infrastructure/adapters/timezone-reminder-enqueuer.adapter";
import { PrismaTodoCompletionStatsReader } from "./infrastructure/persistence/prisma-todo-completion-stats.reader";
import { UserConsentRepository } from "./infrastructure/persistence/user-consent.repository";
import { UserPreferenceRepository } from "./infrastructure/persistence/user-preference.repository";
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
		OnTodoToggledUseCase,
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
	],
	exports: [
		UserSettingsFacade,
		// 미이관 소비자용 전이적 export (auth 시딩·notification 푸시 전달):
		UserPreferenceRepository,
		UserConsentRepository,
	],
})
export class UserSettingsModule {}
