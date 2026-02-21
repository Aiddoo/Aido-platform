import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "@/database/database.module";

import { NotificationModule } from "../notification/notification.module";

import { TimezoneAwareReminderJob } from "./jobs/timezone-aware-reminder.job";
import { TodoReminderJob } from "./jobs/todo-reminder.job";
import {
	InMemoryReminderSchedulerAdapter,
	REMINDER_SCHEDULER,
} from "./reminder";

/**
 * SchedulerModule
 *
 * 일정 기반 알림을 처리하는 크론 작업 모듈.
 * - 타임존 인식 리마인더: 매시간 정각 (Hourly Sweep — 아침/저녁 리마인더 통합)
 * - 할일 리마인더: 매 10분마다 (마감 1시간 전 알림, 폴백)
 * - 인메모리 즉시 스케줄링: 투두 생성/수정 시 정확한 시점에 리마인더 예약
 */
@Module({
	imports: [ScheduleModule.forRoot(), DatabaseModule, NotificationModule],
	providers: [
		TimezoneAwareReminderJob,
		TodoReminderJob,
		{
			provide: REMINDER_SCHEDULER,
			useClass: InMemoryReminderSchedulerAdapter,
		},
	],
	exports: [REMINDER_SCHEDULER],
})
export class SchedulerModule {}
