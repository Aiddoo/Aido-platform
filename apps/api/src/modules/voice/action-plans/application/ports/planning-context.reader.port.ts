import type { ExistingTodo } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface PlanningContext {
  readonly categories: readonly { readonly id: number; readonly name: string }[];
  readonly upcomingTodos: readonly ExistingTodo[];
}

export abstract class PlanningContextReaderPort {
  /** 카테고리 id·이름과 사용자 시간대 오늘부터의 다가오는 할 일 */
  abstract read(userId: UserId, timezone: string): Promise<PlanningContext>;
  abstract findOwnedCategoryIds(userId: UserId): Promise<ReadonlySet<number>>;
}
