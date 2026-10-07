import { Module } from "@nestjs/common";

import { REMINDER_TIMEZONE_CACHE } from "../../../application/ports/reminders/reminder-timezone-cache.port.js";
import { ReminderTimezoneCacheAdapter } from "../../adapters/reminders/reminder-timezone-cache.adapter.js";
import { TimezoneReminderQueueService } from "./timezone-reminder-queue.service.js";

/** 설정 쓰기는 리마인더 큐·캐시만 소비하여 Delivery의 설정 조회 조립을 다시 import하지 않는다. */
@Module({
  providers: [
    TimezoneReminderQueueService,
    { provide: REMINDER_TIMEZONE_CACHE, useClass: ReminderTimezoneCacheAdapter },
  ],
  exports: [TimezoneReminderQueueService, REMINDER_TIMEZONE_CACHE],
})
export class TimezoneReminderQueueModule {}
