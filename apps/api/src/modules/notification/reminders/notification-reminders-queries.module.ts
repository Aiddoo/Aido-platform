import { Module } from "@nestjs/common";

import { ReminderTimezoneCachePort } from "./application/ports/reminder-timezone-cache.port.js";
import { TimezoneReminderEnqueuerPort } from "./application/ports/timezone-reminder-enqueuer.port.js";
import { ReminderTimezoneCacheAdapter } from "./infrastructure/adapters/reminder-timezone-cache.adapter.js";
import { TimezoneReminderQueueAdapter } from "./infrastructure/jobs/timezone-reminder-queue.adapter.js";

/** 설정 쓰기는 리마인더 큐·캐시만 소비하여 리마인더 조회 조립을 다시 import하지 않는다. */
@Module({
  providers: [
    { provide: TimezoneReminderEnqueuerPort, useClass: TimezoneReminderQueueAdapter },
    { provide: ReminderTimezoneCachePort, useClass: ReminderTimezoneCacheAdapter },
  ],
  exports: [TimezoneReminderEnqueuerPort, ReminderTimezoneCachePort],
})
export class NotificationRemindersQueriesModule {}
