import { Module } from "@nestjs/common";

import { DatabaseModule } from "#api/shared/infrastructure/database/database.module";

import { NotificationModule } from "../notification/notification.module.js";
import { WeatherModule } from "../weather/weather.module.js";
import { WeeklyAchievementModule } from "../weekly-achievement/weekly-achievement.module.js";
import { RE_ENGAGEMENT_READER } from "./application/ports/re-engagement-reader.port.js";
import { REMINDER_SCHEDULER } from "./application/ports/reminder-scheduler.port.js";
import { SCHEDULED_REMINDER_READER } from "./application/ports/scheduled-reminder-reader.port.js";
import { SCHEDULER_DEDUP } from "./application/ports/scheduler-dedup.port.js";
import { SCHEDULER_PREFERENCE_READER } from "./application/ports/scheduler-preference-reader.port.js";
import { TIMEZONE_REMINDER_ENQUEUER } from "./application/ports/timezone-reminder-enqueuer.port.js";
import { TODO_REMINDER_READER } from "./application/ports/todo-reminder-reader.port.js";
import { WEATHER_REMINDER_READER } from "./application/ports/weather-reminder-reader.port.js";
import { WEEKLY_ACHIEVEMENT_STATS_READER } from "./application/ports/weekly-achievement-stats-reader.port.js";
import { TimezoneAwareReminderOrchestrator } from "./application/services/timezone-aware-reminder.orchestrator.js";
import {
	EveningReminderStrategy,
	LunchNudgeStrategy,
	MonthlyReportStrategy,
	MorningReminderStrategy,
	NudgeSuggestStrategy,
	OnboardingStrategy,
	SocialDigestStrategy,
	StreakAtRiskStrategy,
	WeatherEveningStrategy,
	WeatherMorningStrategy,
	WeeklyAchievementStrategy,
	WeeklyReportStrategy,
	WinbackStrategy,
} from "./application/strategies/index.js";
import { SchedulerDedupAdapter } from "./infrastructure/adapters/scheduler-dedup.adapter.js";
import { PrismaSchedulerReader } from "./infrastructure/persistence/prisma-scheduler.reader.js";
import { TodoReminderProcessor } from "./infrastructure/processors/todo-reminder.processor.js";
import {
	TimezoneReminderQueueModule,
	TimezoneReminderQueueService,
} from "./infrastructure/queue/index.js";
import { TimezoneReminderProcessor } from "./infrastructure/queue/timezone-reminder-queue.processor.js";
import { BullMQReminderSchedulerAdapter } from "./infrastructure/scheduler/bullmq-reminder-scheduler.adapter.js";

/**
 * SchedulerModule (클린아키텍처 4계층 + 포트/어댑터)
 *
 * 일정 기반 알림을 처리하는 모듈.
 * - 타임존 인식 리마인더: 매분 Sweep (BullMQ Job Scheduler — 아침/저녁 리마인더 통합)
 * - BullMQ 지연 잡: 투두 생성/수정 시 정확한 시점에 리마인더 예약 (Redis 영속성)
 *
 * - domain: 스케줄 정책(순수 함수) — 알림 시간·리마인더 단계·winback·onboarding
 * - application: 오케스트레이터·13 전략·리더/enqueuer 포트
 * - infrastructure: Prisma 리더·BullMQ 큐/스케줄러/프로세서
 */
@Module({
	imports: [
		TimezoneReminderQueueModule,
		DatabaseModule,
		NotificationModule,
		WeatherModule,
		WeeklyAchievementModule,
	],
	providers: [
		// 오케스트레이터 + 전략 (application)
		TimezoneAwareReminderOrchestrator,
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
		WeatherMorningStrategy,
		WeatherEveningStrategy,
		// 리더 어댑터 (단일 Prisma 어댑터 → 분리된 리더 포트들에 바인딩)
		PrismaSchedulerReader,
		SchedulerDedupAdapter,
		{ provide: SCHEDULER_DEDUP, useExisting: SchedulerDedupAdapter },
		{ provide: SCHEDULED_REMINDER_READER, useExisting: PrismaSchedulerReader },
		{ provide: RE_ENGAGEMENT_READER, useExisting: PrismaSchedulerReader },
		{ provide: WEATHER_REMINDER_READER, useExisting: PrismaSchedulerReader },
		{
			provide: WEEKLY_ACHIEVEMENT_STATS_READER,
			useExisting: PrismaSchedulerReader,
		},
		{ provide: TODO_REMINDER_READER, useExisting: PrismaSchedulerReader },
		{
			provide: SCHEDULER_PREFERENCE_READER,
			useExisting: PrismaSchedulerReader,
		},
		// enqueue 포트 (BullMQ 큐 서비스 재사용)
		{
			provide: TIMEZONE_REMINDER_ENQUEUER,
			useExisting: TimezoneReminderQueueService,
		},
		// BullMQ 프로세서 (진입 어댑터)
		TimezoneReminderProcessor,
		TodoReminderProcessor,
		// 리마인더 스케줄러 포트 (todo 소비)
		{
			provide: REMINDER_SCHEDULER,
			useClass: BullMQReminderSchedulerAdapter,
		},
	],
	exports: [REMINDER_SCHEDULER],
})
export class SchedulerModule {}
