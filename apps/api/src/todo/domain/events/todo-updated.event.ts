/**
 * Todo 수정 도메인 이벤트
 *
 * 부분 수정(PATCH /todos/:id) 완료 시 발행됩니다.
 * `completed`는 전이 **후**의 완료 상태(사실)입니다 — 명령 에코가 아닙니다.
 * 완료 상태(true)일 때만 리마인더 취소 부수효과가 동작합니다(완료 todo에는
 * 리마인더가 없으므로 멱등). 토글 전용 스트릭·마일스톤 부수효과는
 * TodoToggledEvent가 담당하며 이 이벤트에는 없습니다.
 */
import { TODO_EVENTS } from "./todo-event-names";

export class TodoUpdatedEvent {
	readonly eventName = TODO_EVENTS.UPDATED;

	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly completed: boolean,
	) {}
}
