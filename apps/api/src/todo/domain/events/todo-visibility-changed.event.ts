/**
 * Todo 공개 범위 변경 도메인 이벤트 (PATCH /todos/:id/visibility)
 *
 * 친구에게 보이는 투두와 일별 완료 현황은 PUBLIC 투두만 집계하므로,
 * 공개 범위가 바뀌면 소유자 기준 공개 캐시를 무효화해야 합니다.
 */
import { TODO_EVENTS } from "./todo-event-names";

export class TodoVisibilityChangedEvent {
	readonly eventName = TODO_EVENTS.VISIBILITY_CHANGED;

	constructor(
		public readonly todoId: number,
		public readonly userId: string,
	) {}
}
