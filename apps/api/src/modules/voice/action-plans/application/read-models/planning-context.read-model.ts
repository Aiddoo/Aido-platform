import type { ExistingTodo } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";

/** 계획을 만들 때 AI에 주는 사용자 문맥. 카테고리 id·이름과 사용자 시간대 오늘부터의 다가오는 할 일 */
export interface PlanningContextReadModel {
  readonly categories: readonly { readonly id: number; readonly name: string }[];
  readonly upcomingTodos: readonly ExistingTodo[];
}
