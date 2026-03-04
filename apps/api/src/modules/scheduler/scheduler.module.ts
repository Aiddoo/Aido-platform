import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "@/database/database.module";

import { NotificationModule } from "../notification/notification.module";

import { TimezoneAwareReminderJob } from "./jobs/timezone-aware-reminder.job";
import {
	BullMQReminderSchedulerAdapter,
	REMINDER_SCHEDULER,
	TODO_REMINDER_QUEUE,
	TodoReminderProcessor,
} from "./reminder";

/**
 * SchedulerModule
 *
 * 일정 기반 알림을 처리하는 크론 작업 모듈.
 * - 타임존 인식 리마인더: 매시간 정각 (Hourly Sweep — 아침/저녁 리마인더 통합)
 * - BullMQ 지연 잡: 투두 생성/수정 시 정확한 시점에 리마인더 예약 (Redis 영속성)
 */
@Module({
	imports: [
		ScheduleModule.forRoot(),
		BullModule.registerQueue({ name: TODO_REMINDER_QUEUE }),
		DatabaseModule,
		NotificationModule,
	],
	providers: [
		TimezoneAwareReminderJob,
		TodoReminderProcessor,
		{
			provide: REMINDER_SCHEDULER,
			useClass: BullMQReminderSchedulerAdapter,
		},
	],
	exports: [REMINDER_SCHEDULER],
})
export class SchedulerModule {}
