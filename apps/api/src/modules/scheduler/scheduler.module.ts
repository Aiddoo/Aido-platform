import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/database/database.module";

import { NotificationModule } from "../notification/notification.module";
import { WeeklyAchievementModule } from "../weekly-achievement/weekly-achievement.module";
import {
	EveningReminderStrategy,
	LunchNudgeStrategy,
	MonthlyReportStrategy,
	MorningReminderStrategy,
	NudgeSuggestStrategy,
	OnboardingStrategy,
	SocialDigestStrategy,
	StreakAtRiskStrategy,
	WeeklyAchievementStrategy,
	WeeklyReportStrategy,
	WinbackStrategy,
} from "./jobs/strategies";
import { TimezoneAwareReminderJob } from "./jobs/timezone-aware-reminder.job";
import {
	TimezoneReminderProcessor,
	TimezoneReminderQueueModule,
} from "./queue";
import {
	BullMQReminderSchedulerAdapter,
	REMINDER_SCHEDULER,
	TODO_REMINDER_QUEUE,
	TodoReminderProcessor,
} from "./reminder";

/**
 * SchedulerModule
 *
 * 일정 기반 알림을 처리하는 모듈.
 * - 타임존 인식 리마인더: 매분 Sweep (BullMQ Job Scheduler — 아침/저녁 리마인더 통합)
 * - BullMQ 지연 잡: 투두 생성/수정 시 정확한 시점에 리마인더 예약 (Redis 영속성)
 */
@Module({
	imports: [
		BullModule.registerQueue({ name: TODO_REMINDER_QUEUE }),
		TimezoneReminderQueueModule,
		DatabaseModule,
		NotificationModule,
		WeeklyAchievementModule,
	],
	providers: [
		TimezoneAwareReminderJob,
		TimezoneReminderProcessor,
		TodoReminderProcessor,
		MorningReminderStrategy,
		EveningReminderStrategy,
		OnboardingStrategy,
		WeeklyReportStrategy,
		MonthlyReportStrategy,
		WeeklyAchievementStrategy,
		WinbackStrategy,
		NudgeSuggestStrategy,
		SocialDigestStrategy,
		LunchNudgeStrategy,
		StreakAtRiskStrategy,
		{
			provide: REMINDER_SCHEDULER,
			useClass: BullMQReminderSchedulerAdapter,
		},
	],
	exports: [REMINDER_SCHEDULER],
})
export class SchedulerModule {}
