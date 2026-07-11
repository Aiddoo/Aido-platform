/**
 * Todo 완료 상태 토글 도메인 이벤트
 *
 * 스트릭 갱신(양방향), 리마인더 취소·친구 완료 알림·마일스톤(완료 시)의 트리거입니다.
 * 부수효과는 EventsHandler가 트랜잭션 커밋 이후 처리합니다.
 */
import { TODO_EVENTS } from "./todo-event-names";

export class TodoToggledEvent {
	readonly eventName = TODO_EVENTS.TOGGLED;

	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly completed: boolean,
		public readonly timezone: string,
	) {}
}
