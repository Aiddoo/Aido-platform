/**
 * Todo 생성 도메인 이벤트
 *
 * 리마인더 스케줄링 등 생성 부수효과의 트리거로 사용됩니다.
 */
export class TodoCreatedEvent {
	constructor(
		public readonly todoId: number,
		public readonly userId: string,
		public readonly scheduledTime: Date | null,
	) {}
}
