import type {
  LinkedTodoPageQuery,
  TodoImportLink,
} from "#api/modules/planning/todo-imports/application/ports/todo-import-link.repository.port";
import { TodoImportLinkRepositoryPort } from "#api/modules/planning/todo-imports/application/ports/todo-import-link.repository.port";
import type { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 실제 테이블처럼 할 일 하나에 링크 하나, 사용자마다 같은 sourceKey는 하나다
export class InMemoryTodoImportLinkRepository extends TodoImportLinkRepositoryPort {
  readonly #links = new Map<number, TodoImportLink>();

  get size(): number {
    return this.#links.size;
  }

  /** 할 일을 지우면 FK cascade로 링크가 사라지는 것을 흉내 낸다 */
  removeTodo(todoId: number): void {
    this.#links.delete(todoId);
  }

  async listLinkedSourceKeys(
    userId: UserId,
    sourceKeys: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const wanted = new Set(sourceKeys);
    return new Set(
      [...this.#links.values()]
        .filter((link) => link.userId.equals(userId) && wanted.has(link.sourceKey))
        .map((link) => link.sourceKey),
    );
  }

  async insertMany(links: readonly TodoImportLink[]): Promise<void> {
    for (const link of links) {
      const isTaken = [...this.#links.values()].some(
        (stored) => stored.userId.equals(link.userId) && stored.sourceKey === link.sourceKey,
      );
      if (!this.#links.has(link.todoId.value) && !isTaken) {
        this.#links.set(link.todoId.value, link);
      }
    }
  }

  async listTodoIds(query: LinkedTodoPageQuery): Promise<TodoId[]> {
    const afterTodoId = query.afterTodoId?.value ?? Number.NEGATIVE_INFINITY;
    return [...this.#links.values()]
      .filter((link) => link.importId.equals(query.importId) && link.todoId.value > afterTodoId)
      .map((link) => link.todoId.value)
      .toSorted((left, right) => left - right)
      .slice(0, query.limit)
      .map((todoId) => TodoId.reconstitute(todoId));
  }

  async countByImportId(importId: TodoImportId): Promise<number> {
    return [...this.#links.values()].filter((link) => link.importId.equals(importId)).length;
  }
}
