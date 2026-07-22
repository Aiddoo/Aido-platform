import { Module } from "@nestjs/common";

import { TimezoneReminderQueueService } from "./timezone-reminder-queue.service";

/**
 * Timezone Reminder Queue 모듈
 *
 * BullMQ 큐 등록과 TimezoneReminderQueueService만 포함합니다.
 * SchedulerModule과 분리하여 순환 참조를 방지합니다.
 *
 * - UserSettingsModule 등 큐 서비스만 필요한 모듈은 이 모듈을 직접 import
 * - SchedulerModule은 이 모듈을 import하여 Processor와 함께 구성
 */
@Module({
	providers: [TimezoneReminderQueueService],
	exports: [TimezoneReminderQueueService],
})
export class TimezoneReminderQueueModule {}
