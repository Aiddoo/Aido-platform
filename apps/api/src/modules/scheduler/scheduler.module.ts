import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "@/database/database.module";

import { NotificationModule } from "../notification/notification.module";

import { EveningReminderJob } from "./jobs/evening-reminder.job";
import { MorningReminderJob } from "./jobs/morning-reminder.job";
import { TodoReminderJob } from "./jobs/todo-reminder.job";

/**
 * SchedulerModule
 *
 * 일정 기반 알림을 처리하는 크론 작업 모듈.
 * - 아침 리마인더: 매일 08:00 (오늘 할일 안내)
 * - 저녁 리마인더: 매일 18:00 (완료 여부에 따른 메시지)
 * - 할일 리마인더: 매 10분마다 (마감 1시간 전 알림)
 */
@Module({
	imports: [ScheduleModule.forRoot(), DatabaseModule, NotificationModule],
	providers: [MorningReminderJob, EveningReminderJob, TodoReminderJob],
})
export class SchedulerModule {}
