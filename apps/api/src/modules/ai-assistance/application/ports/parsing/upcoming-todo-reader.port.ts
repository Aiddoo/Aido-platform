import type { ExistingTodo } from "../../../domain/policies/planning/action-plan-dedupe.policy.js";

export const UPCOMING_TODO_READER = Symbol("UPCOMING_TODO_READER");

export interface UpcomingTodoReaderPort {
  /** 사용자 시간대 오늘부터의 다가오는 할 일. 반복 할 일은 다음 회차 하나다. */
  findByUserId(userId: string, timezone: string): Promise<readonly ExistingTodo[]>;
}
