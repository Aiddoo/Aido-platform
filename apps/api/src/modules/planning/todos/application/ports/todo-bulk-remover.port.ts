import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCategoryId } from "../../../categories/domain/todo-category-id.vo.js";
import type { TodoId } from "../../../shared/domain/todo-id.vo.js";

export interface RemovedTodo {
  readonly id: TodoId;
  readonly scheduledTime: Temporal.Instant | null;
}

export interface RemovedCategoryTodos {
  readonly todos: readonly RemovedTodo[];
  /** 지운 반복 규칙 수. 끝난 규칙도 센다 */
  readonly seriesCount: number;
}

/**
 * 카테고리 하나의 할 일과 반복 규칙을 집합 문장으로 지운다. 하위 항목·댓글·좋아요·조회·찌르기는 FK cascade로 함께 지워진다.
 * 활성 UoW 안에서 부른다. 지운 행은 DELETE가 잡은 행 잠금이 커밋까지 막아 동시 수정이 되살리지 못한다.
 */
export abstract class TodoBulkRemoverPort {
  abstract removeByCategory(
    userId: UserId,
    categoryId: TodoCategoryId,
  ): Promise<RemovedCategoryTodos>;
}
