/**
 * Todo 생성 도메인 이벤트
 *
 * 리마인더 스케줄링 등 생성 부수효과의 트리거로 사용됩니다.
 */
import { TODO_EVENTS } from "./todo-event-names";

export class TodoCreatedEvent {
	readonly eventName = TODO_EVENTS.CREATED;

	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly scheduledTime: Date | null,
	) {}
}
