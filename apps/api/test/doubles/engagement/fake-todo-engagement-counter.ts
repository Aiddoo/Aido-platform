import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  type TodoCommentCount,
  TodoEngagementCounterPort,
  type TodoViewRecord,
} from "#api/modules/planning/todos/planning-todos.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** planning이 가진 할 일 숫자 칸을 흉내 낸다. 0 아래로 내리지 않는 규칙은 실제 어댑터와 같다 */
export class FakeTodoEngagementCounter extends TodoEngagementCounterPort {
  readonly commentCounts = new Map<number, number>();
  readonly viewCounts = new Map<number, number>();
  readonly lockedTodoIds: number[][] = [];
  readonly #views = new Set<string>();

  async increaseCommentCount(todoId: TodoId, amount: number): Promise<void> {
    this.commentCounts.set(todoId.value, (this.commentCounts.get(todoId.value) ?? 0) + amount);
  }

  async decrementCommentCount(todoId: TodoId): Promise<boolean> {
    const count = this.commentCounts.get(todoId.value) ?? 0;
    if (count === 0) {
      return false;
    }
    this.commentCounts.set(todoId.value, count - 1);
    return true;
  }

  async recordView(todoId: TodoId, viewerId: UserId): Promise<TodoViewRecord> {
    const key = `${todoId.value}:${viewerId.value}`;
    const recorded = !this.#views.has(key);
    this.#views.add(key);
    const viewCount = (this.viewCounts.get(todoId.value) ?? 0) + Number(recorded);
    this.viewCounts.set(todoId.value, viewCount);
    return { recorded, viewCount };
  }

  async lockCounters(todoIds: readonly TodoId[]): Promise<void> {
    this.lockedTodoIds.push(todoIds.map((todoId) => todoId.value));
  }

  async replaceCommentCounts(counts: readonly TodoCommentCount[]): Promise<void> {
    for (const { todoId, commentCount } of counts) {
      this.commentCounts.set(todoId, commentCount);
    }
  }
}
