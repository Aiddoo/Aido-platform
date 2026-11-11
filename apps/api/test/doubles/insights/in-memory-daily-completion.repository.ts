import {
  type DailyCompletionRangeQuery,
  DailyCompletionRepositoryPort,
} from "#api/modules/insights/daily-completions/application/ports/daily-completion.repository.port";
import { tallyDailyCompletions } from "#api/modules/insights/daily-completions/domain/daily-completion.domain-service";
import type { DailyCompletion } from "#api/modules/insights/daily-completions/domain/daily-completion.entity";
import type { TodoSeed } from "#test/fixtures/insights/daily-completion.fixture";

// Drizzle 저장소처럼 심은 할 일을 같은 도메인 규칙(tallyDailyCompletions)으로 센다
export class InMemoryDailyCompletionRepository extends DailyCompletionRepositoryPort {
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

  /** 다음 집계를 센 직후 멈춘다. 조회와 쓰기가 겹치는 경합을 재현할 때 쓴다 */
  holdNextRead(): { readonly entered: Promise<void>; readonly release: () => void } {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    this.#heldRead = { entered: entered.resolve, release: release.promise };
    return { entered: entered.promise, release: release.resolve };
  }

  async listByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#afterHeld(this.#tally(query, false));
  }

  async listPublicByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]> {
    return this.#afterHeld(this.#tally(query, true));
  }

  async #afterHeld(completions: DailyCompletion[]): Promise<DailyCompletion[]> {
    const held = this.#heldRead;
    if (held != null) {
      this.#heldRead = null;
      held.entered();
      await held.release;
    }
    return completions;
  }

  #owned(query: DailyCompletionRangeQuery, publicOnly: boolean): TodoSeed[] {
    return this.#todos.filter(
      (todo) => todo.userId === query.userId.value && (!publicOnly || todo.isPublic),
    );
  }

  #tally(query: DailyCompletionRangeQuery, publicOnly: boolean): DailyCompletion[] {
    return tallyDailyCompletions({
      userId: query.userId,
      range: query.range,
      groups: this.#owned(query, publicOnly).map((todo) => ({
        startDate: todo.startDate,
        endDate: todo.endDate,
        completed: todo.completed,
        categoryColor: todo.categoryColor,
        todoCount: 1,
      })),
    });
  }
}
