export const TODO_REMINDER = Symbol("TODO_REMINDER");

/**
 * Todo 리마인더 스케줄링 포트 (scheduler 컨텍스트 경계)
 *
 * todo 모듈이 소유하는 계약입니다. 구현은 인프라 어댑터가
 * scheduler 모듈의 IReminderScheduler에 위임합니다.
 */
export interface TodoReminderPort {
	/**
	 * 리마인더 등록 — 같은 todoId로 재호출 시 기존 예약을 대체합니다.
	 * fire-and-forget이며 실패는 구현체가 로깅합니다.
	 */
	scheduleReminder(todoId: number, scheduledTime: Date, userId: string): void;

	/** 리마인더 취소 */
	cancelReminder(todoId: number): void;
}
