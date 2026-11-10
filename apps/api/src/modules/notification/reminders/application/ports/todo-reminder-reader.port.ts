/**
 * 투두 리마인더 잡 처리용 조회 포트.
 *
 * 지연 잡 실행 시 투두 유효성(미완료)을 확인한다. 중복은 알림 행의 유니크 인덱스가 막는다.
 */
import type { ActiveTodo } from "../read-models/scheduler.read-model.js";

export const TODO_REMINDER_READER = Symbol("TODO_REMINDER_READER");

export interface TodoReminderReaderPort {
  /** 미완료(유효) 투두 조회 (완료/삭제 시 null) */
  findActiveTodo(todoId: number): Promise<ActiveTodo | null>;
}
