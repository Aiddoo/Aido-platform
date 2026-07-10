import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { TodoRescheduledEvent } from "../../domain/events/todo-rescheduled.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 일정 변경 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 재스케줄, 없으면 취소합니다.
 * 실패는 로깅만 하고 삼킵니다(fire-and-forget — 레거시 동작 보존).
 */
@EventsHandler(TodoRescheduledEvent)
export class TodoRescheduledHandler
	implements IEventHandler<TodoRescheduledEvent>
{
	readonly #logger = new Logger(TodoRescheduledHandler.name);

	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	handle(event: TodoRescheduledEvent): void {
		try {
			if (event.scheduledTime) {
				this.todoReminder.scheduleReminder(
					event.todoId,
					event.scheduledTime,
					event.userId,
				);
			} else {
				this.todoReminder.cancelReminder(event.todoId);
			}
		} catch (error) {
			this.#logger.error(
				`Failed to reschedule reminder for todo ${event.todoId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
