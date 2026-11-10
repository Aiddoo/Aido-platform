import type { ExistingTodo } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";

export const PLANNING_CONTEXT_READER = Symbol("PLANNING_CONTEXT_READER");

export interface PlanningContext {
  readonly categories: readonly { readonly id: number; readonly name: string }[];
  readonly upcomingTodos: readonly ExistingTodo[];
}

export interface PlanningContextReaderPort {
  /** 카테고리 id·이름과 사용자 시간대 오늘부터의 다가오는 할 일 */
  read(userId: string, timezone: string): Promise<PlanningContext>;
  findOwnedCategoryIds(userId: string): Promise<ReadonlySet<number>>;
}
