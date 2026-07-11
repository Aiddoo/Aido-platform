import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { TodoDeletedEvent } from "../../domain/events/todo-deleted.event";
import { TODO_EVENTS } from "../../domain/events/todo-event-names";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 삭제 이벤트 핸들러
 *
 * 삭제된 할 일의 리마인더를 취소합니다.
 * 실패는 로깅만 하고 삼킵니다(fire-and-forget — 레거시 동작 보존).
 */
@Injectable()
export class TodoDeletedHandler {
	readonly #logger = new Logger(TodoDeletedHandler.name);

	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	@OnEvent(TODO_EVENTS.DELETED)
	handle(event: TodoDeletedEvent): void {
		try {
			this.todoReminder.cancelReminder(event.todoId);
		} catch (error) {
			this.#logger.error(
				`Failed to cancel reminder for deleted todo ${event.todoId}: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
