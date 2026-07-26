export const TODO_REMINDER = Symbol("TODO_REMINDER");

export type TodoReminderCancellationResult =
	| { readonly status: "cancelled" }
	| { readonly status: "missing" };

/**
 * Todo 리마인더 스케줄링 포트 (scheduler 컨텍스트 경계)
 *
 * todo 모듈이 소유하는 계약입니다. 구현은 인프라 어댑터가
 * scheduler 모듈의 IReminderScheduler에 위임합니다.
 */
export interface TodoReminderPort {
	/**
	 * 리마인더 등록 — 같은 todoId로 재호출 시 기존 예약을 대체합니다.
	 * 기존 예약 취소나 새 작업 등록 실패는 reject됩니다.
	 */
	scheduleReminder(
		todoId: number,
		scheduledTime: Date,
		userId: string,
	): Promise<void>;

	/**
	 * 리마인더 취소.
	 *
	 * 이미 처리됐거나 없는 작업만 `missing`이며, 인프라 실패는 reject됩니다.
	 */
	cancelReminder(todoId: number): Promise<TodoReminderCancellationResult>;
}
