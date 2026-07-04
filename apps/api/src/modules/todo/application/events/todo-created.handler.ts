import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { TodoCreatedEvent } from "../../domain/events/todo-created.event";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 생성 이벤트 핸들러
 *
 * scheduledTime이 있으면 리마인더를 스케줄링합니다(실패는 로깅만, fire-and-forget).
 */
@EventsHandler(TodoCreatedEvent)
export class TodoCreatedHandler implements IEventHandler<TodoCreatedEvent> {
	readonly #logger = new Logger(TodoCreatedHandler.name);

	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	handle(event: TodoCreatedEvent): void {
		if (!event.scheduledTime) {
			return;
		}

		try {
			this.todoReminder.scheduleReminder(
				event.todoId,
				event.scheduledTime,
				event.userId,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to schedule reminder for todo ${event.todoId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
