import { TODO_REMINDER_QUEUE as TODO_REMINDER_QUEUE_DEFINITION } from "./reminders/infrastructure/jobs/todo-reminder.queue.js";

// 다른 Context가 쓰던 큐 이름 문자열 export다. 정의는 reminders slice의 *.queue.ts에 있다
export const TODO_REMINDER_QUEUE = TODO_REMINDER_QUEUE_DEFINITION.name;

export { TodoReminderSchedulerPort } from "./reminders/application/ports/todo-reminder-scheduler.port.js";
export { NotificationRemindersModule } from "./reminders/notification-reminders.module.js";
