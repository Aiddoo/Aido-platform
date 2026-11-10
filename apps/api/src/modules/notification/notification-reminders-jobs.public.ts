import { TIMEZONE_REMINDER_QUEUE as TIMEZONE_REMINDER_QUEUE_DEFINITION } from "./reminders/infrastructure/jobs/timezone-reminder.queue.js";

// 다른 Context가 쓰던 큐 이름 문자열 export다. 정의는 reminders slice의 *.queue.ts에 있다
export const TIMEZONE_REMINDER_QUEUE = TIMEZONE_REMINDER_QUEUE_DEFINITION.name;

/** Identity 설정에서 큐만 참조할 때 리마인더 조회 모듈을 다시 초기화하지 않는다. */
export { TimezoneReminderQueueModule } from "./reminders/infrastructure/jobs/timezone-reminder-queue.module.js";
export {
  TimezoneReminderQueueAdapter,
  TimezoneReminderQueueAdapter as TimezoneReminderQueueService,
} from "./reminders/infrastructure/jobs/timezone-reminder-queue.adapter.js";
export { TimezoneReminderEnqueuerPort } from "./reminders/application/ports/timezone-reminder-enqueuer.port.js";
