import type {
  TodoSeries,
  TodoOccurrenceDraft,
} from "../../../domain/aggregates/series/todo-series.aggregate.js";
import { occurrenceHorizon } from "../../../domain/policies/series/occurrence-horizon.policy.js";
import type {
  CreatedOccurrence,
  TodoRepositoryPort,
} from "../../ports/todos/todo.repository.port.js";

/**
 * 한 번에 만드는 회차 상한. 아주 먼 과거에서 시작하는 규칙이 한 트랜잭션에 몰리지 않게 하고,
 * 남은 회차는 커서에 남아 다음 회차 채우기가 이어서 만든다.
 */
export const MAX_OCCURRENCES_PER_RUN = 400;

interface TodoOccurrenceMaterializerDependencies {
  readonly todoRepository: Pick<TodoRepositoryPort, "getMaxSortOrder" | "insertOccurrences">;
}

/** 규칙의 커서부터 미리 만드는 기간까지 회차를 실제 행으로 만든다. 저장은 활성 UoW 안에서 한다. */
export class TodoOccurrenceMaterializer {
  readonly #dependencies: TodoOccurrenceMaterializerDependencies;

  constructor(dependencies: TodoOccurrenceMaterializerDependencies) {
    this.#dependencies = dependencies;
  }

  /** 기간 안의 회차를 계획한다. 먼 미래에 시작하는 새 규칙도 첫 회차는 바로 보여야 한다. */
  planFirstRun(series: TodoSeries, at: Date): TodoOccurrenceDraft[] {
    const horizon = occurrenceHorizon(series.getTimezone(), at);
    const next = series.getNextOccurrenceDate();
    const through = next != null && next > horizon ? next : horizon;
    return series.planOccurrences(through, MAX_OCCURRENCES_PER_RUN);
  }

  planDueRun(series: TodoSeries, at: Date): TodoOccurrenceDraft[] {
    return series.planOccurrences(
      occurrenceHorizon(series.getTimezone(), at),
      MAX_OCCURRENCES_PER_RUN,
    );
  }

  async persist(
    series: TodoSeries,
    drafts: readonly TodoOccurrenceDraft[],
  ): Promise<readonly CreatedOccurrence[]> {
    if (drafts.length === 0) {
      return [];
    }
    const maxSortOrder = await this.#dependencies.todoRepository.getMaxSortOrder(
      series.getUserId(),
    );
    return this.#dependencies.todoRepository.insertOccurrences(
      drafts.map((draft, index) => ({ ...draft, sortOrder: maxSortOrder + 1 + index })),
      series.getId(),
      series.getChecklistTemplate(),
    );
  }
}
