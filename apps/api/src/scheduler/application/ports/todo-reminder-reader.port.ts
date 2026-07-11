/**
 * 투두 리마인더 잡 처리용 조회 포트.
 *
 * 지연 잡 실행 시 투두 유효성(미완료) 확인과 24시간 내 동일 알림 dedup 판정을 담당한다.
 */
import type { ActiveTodo } from "./scheduler-read-models";

export const TODO_REMINDER_READER = Symbol("TODO_REMINDER_READER");

export interface TodoReminderReaderPort {
	/** 미완료(유효) 투두 조회 (완료/삭제 시 null) */
	findActiveTodo(todoId: number): Promise<ActiveTodo | null>;

	/** since 이후 동일 단계 TODO_REMINDER 알림 존재 여부 (dedup) */
	existsRecentReminderNotification(params: {
		todoId: number;
		since: Date;
		stage: string;
	}): Promise<boolean>;
}
