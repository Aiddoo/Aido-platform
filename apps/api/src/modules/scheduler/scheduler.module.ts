import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "@/database/database.module";

import { NotificationModule } from "../notification/notification.module";

import { TimezoneAwareReminderJob } from "./jobs/timezone-aware-reminder.job";
import { TodoReminderJob } from "./jobs/todo-reminder.job";

/**
 * SchedulerModule
 *
 * 일정 기반 알림을 처리하는 크론 작업 모듈.
 * - 타임존 인식 리마인더: 매시간 정각 (Hourly Sweep — 아침/저녁 리마인더 통합)
 * - 할일 리마인더: 매 10분마다 (마감 1시간 전 알림)
 */
@Module({
	imports: [ScheduleModule.forRoot(), DatabaseModule, NotificationModule],
	providers: [TimezoneAwareReminderJob, TodoReminderJob],
})
export class SchedulerModule {}
