/**
 * 리마인더 스케줄러 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ BullMQ 무중단 전환 가능
 */

export const REMINDER_SCHEDULER = Symbol("REMINDER_SCHEDULER");

export interface IReminderScheduler {
	/**
	 * 리마인더 타이머 등록
	 *
	 * scheduledTime 기준으로 REMINDER_LEAD_TIME_MS 전에 알림을 발송하도록 예약합니다.
	 * 같은 todoId로 재호출하면 기존 예약을 취소하고 새로 등록합니다.
	 *
	 * @param todoId 대상 투두 ID
	 * @param scheduledTime 투두 마감 시각
	 * @param userId 사용자 ID
	 * @param todoTitle 투두 제목 (알림 메시지용)
	 */
	scheduleReminder(
		todoId: number,
		scheduledTime: Date,
		userId: string,
		todoTitle: string,
	): void;

	/**
	 * 리마인더 타이머 취소
	 *
	 * @param todoId 대상 투두 ID
	 */
	cancelReminder(todoId: number): void;
}
