import { Inject, Injectable } from "@nestjs/common";
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
 * 취소할 잡이 없는 경우는 정상 처리하고, 인프라 실패는 이벤트 경계까지 전파합니다.
 */
@Injectable()
export class TodoDeletedHandler {
	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	@OnEvent(TODO_EVENTS.DELETED, { suppressErrors: false })
	async handle(event: TodoDeletedEvent): Promise<void> {
		await this.todoReminder.cancelReminder(event.todoId);
	}
}
