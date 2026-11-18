import {
  type CompletionGroupQuery,
  CompletionGroupReaderPort,
} from "#api/modules/insights/daily-completions/application/ports/completion-group.reader.port";
import type { TodoCompletionGroup } from "#api/modules/insights/daily-completions/domain/daily-completion.domain-service";
import type { TodoSeed } from "#test/fixtures/insights/daily-completion.fixture";

// planning 조회 포트처럼 구간의 어느 날에든 걸친 할 일만 고르고, 묶지 않고 한 개씩 돌려준다
export class InMemoryCompletionGroupReader extends CompletionGroupReaderPort {
  readonly #todos: TodoSeed[];
  #heldRead: { readonly entered: () => void; readonly release: Promise<void> } | null = null;

  constructor(todos: readonly TodoSeed[] = []) {
    super();
    this.#todos = [...todos];
  }

  add(...todos: readonly TodoSeed[]): void {
    this.#todos.push(...todos);
  }

  clear(): void {
    this.#todos.length = 0;
  }

  /** 다음 조회를 읽은 직후 멈춘다. 조회와 쓰기가 겹치는 경합을 재현할 때 쓴다 */
  holdNextRead(): { readonly entered: Promise<void>; readonly release: () => void } {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    this.#heldRead = { entered: entered.resolve, release: release.promise };
    return { entered: entered.promise, release: release.resolve };
  }

  async listByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]> {
    return this.#afterHeld(this.#groupsOf(query, false));
  }

  async listPublicByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]> {
    return this.#afterHeld(this.#groupsOf(query, true));
  }

  async #afterHeld(groups: TodoCompletionGroup[]): Promise<TodoCompletionGroup[]> {
    const held = this.#heldRead;
    if (held != null) {
      this.#heldRead = null;
      held.entered();
      await held.release;
    }
    return groups;
  }

  #groupsOf(query: CompletionGroupQuery, publicOnly: boolean): TodoCompletionGroup[] {
    return this.#todos
      .filter(
        (todo) =>
          todo.userId === query.userId.value &&
          (!publicOnly || todo.isPublic) &&
          Temporal.PlainDate.compare(todo.startDate, query.range.end) <= 0 &&
          Temporal.PlainDate.compare(todo.endDate ?? todo.startDate, query.range.start) >= 0,
      )
      .map((todo) => ({
        startDate: todo.startDate,
        endDate: todo.endDate,
        completed: todo.completed,
        categoryColor: todo.categoryColor,
        todoCount: 1,
      }));
  }
}
