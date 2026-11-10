import { Module } from "@nestjs/common";

import { REMINDER_TIMEZONE_CACHE } from "../../application/ports/reminder-timezone-cache.port.js";
import { ReminderTimezoneCacheAdapter } from "../adapters/reminder-timezone-cache.adapter.js";
import { TimezoneReminderQueueAdapter } from "./timezone-reminder-queue.adapter.js";

/** 설정 쓰기는 리마인더 큐·캐시만 소비하여 Delivery의 설정 조회 조립을 다시 import하지 않는다. */
@Module({
  providers: [
    TimezoneReminderQueueAdapter,
    { provide: REMINDER_TIMEZONE_CACHE, useClass: ReminderTimezoneCacheAdapter },
  ],
  exports: [TimezoneReminderQueueAdapter, REMINDER_TIMEZONE_CACHE],
})
export class TimezoneReminderQueueModule {}
