import { TODO_REMINDER_QUEUE as TODO_REMINDER_QUEUE_DEFINITION } from "./infrastructure/jobs/todo-reminder.queue.js";

// 다른 Context가 쓰던 큐 이름 문자열 export다. 정의는 이 slice의 *.queue.ts에 있다
export const TODO_REMINDER_QUEUE = TODO_REMINDER_QUEUE_DEFINITION.name;

export { NotificationRemindersModule } from "./notification-reminders.module.js";
export { TodoReminderSchedulerPort } from "./application/ports/todo-reminder-scheduler.port.js";
export { NOTIFICATION_SCHEDULE } from "./domain/notification-schedule.domain-service.js";
