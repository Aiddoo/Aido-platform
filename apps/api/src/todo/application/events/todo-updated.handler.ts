import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { TODO_EVENTS } from "../../domain/events/todo-event-names";
import { TodoUpdatedEvent } from "../../domain/events/todo-updated.event";
import { TODO_REMINDER, type TodoReminderPort } from "../ports/todo-reminder.port";

/**
 * Todo 수정 이벤트 핸들러
 *
 * 완료 요청(completed=true)일 때만 리마인더를 취소합니다.
 * 부분 수정은 스트릭·마일스톤·친구 완료 알림을 트리거하지 않습니다
 * (그 부수효과는 완료 토글 전용 — TodoToggledEvent가 담당, 레거시 동작 보존).
 * 취소할 잡이 없는 경우는 정상 처리하고, 인프라 실패는 이벤트 경계까지 전파합니다.
 */
@Injectable()
export class TodoUpdatedHandler {
	constructor(
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	@OnEvent(TODO_EVENTS.UPDATED, { suppressErrors: false })
	async handle(event: TodoUpdatedEvent): Promise<void> {
		if (event.completed !== true) {
			return;
		}

		await this.todoReminder.cancelReminder(event.todoId);
	}
}
