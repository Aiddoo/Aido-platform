import { Module } from "@nestjs/common";

import {
  REMINDER_TIMEZONE_CACHE,
  ReminderTimezoneCachePort,
} from "../../application/ports/reminder-timezone-cache.port.js";
import { TimezoneReminderEnqueuerPort } from "../../application/ports/timezone-reminder-enqueuer.port.js";
import { ReminderTimezoneCacheAdapter } from "../adapters/reminder-timezone-cache.adapter.js";
import { TimezoneReminderQueueAdapter } from "./timezone-reminder-queue.adapter.js";

/** 설정 쓰기는 리마인더 큐·캐시만 소비하여 리마인더 조회 조립을 다시 import하지 않는다. */
@Module({
  providers: [
    TimezoneReminderQueueAdapter,
    { provide: TimezoneReminderEnqueuerPort, useExisting: TimezoneReminderQueueAdapter },
    { provide: ReminderTimezoneCachePort, useClass: ReminderTimezoneCacheAdapter },
    // identity가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 둔다
    { provide: REMINDER_TIMEZONE_CACHE, useExisting: ReminderTimezoneCachePort },
  ],
  exports: [
    TimezoneReminderQueueAdapter,
    TimezoneReminderEnqueuerPort,
    ReminderTimezoneCachePort,
    REMINDER_TIMEZONE_CACHE,
  ],
})
export class TimezoneReminderQueueModule {}
