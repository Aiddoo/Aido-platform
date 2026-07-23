/**
 * Todo 카테고리 변경 도메인 이벤트 (PATCH /todos/:id/category)
 *
 * 일별 완료 통계는 각 할 일의 카테고리 색상을 일자별로 집계하므로,
 * 카테고리가 바뀌면 daily-completion 캐시(캘린더 dot 색상)가 스테일해집니다.
 * 무효화 부수효과는 크로스모듈 @OnEvent 구독자가 커밋 후 처리합니다.
 */
import { TODO_EVENTS } from "./todo-event-names";

export class TodoCategoryChangedEvent {
	readonly eventName = TODO_EVENTS.CATEGORY_CHANGED;

	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly categoryId: number,
	) {}
}
