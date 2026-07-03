/**
 * Todo 수정 도메인 이벤트
 *
 * 부분 수정(PATCH /todos/:id) 완료 시 발행됩니다.
 * `completed`는 요청에 포함된 값 그대로 전달합니다(미포함 시 undefined) —
 * 완료 요청(true)일 때만 리마인더 취소 부수효과가 동작합니다.
 * 토글 전용 스트릭·마일스톤 부수효과는 TodoToggledEvent가 담당하며 이 이벤트에는 없습니다.
 */
export class TodoUpdatedEvent {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly completed: boolean | undefined,
	) {}
}
