import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import { buildDailyCompletionsRange } from "../../domain/daily-completion.domain-service.js";
import type { DailyCompletionsRange } from "../../domain/daily-completion.read-model.js";
import { type DailyCompletionCachePort } from "../ports/daily-completion-cache.port.js";
import { type TodoCompletionRepositoryPort } from "../ports/todo-completion.repository.port.js";

export interface GetDailyCompletionsQuery {
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
}

interface GetDailyCompletionsDependencies {
  readonly repository: Pick<
    TodoCompletionRepositoryPort,
    "aggregateByDateRange" | "findMultiDayTodos"
  >;
  readonly cache: Pick<DailyCompletionCachePort, "readRange" | "storeRangeIfCurrent">;
}

export class GetDailyCompletionsUseCase {
  readonly #dependencies: GetDailyCompletionsDependencies;

  constructor(dependencies: GetDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetDailyCompletionsQuery): Promise<DailyCompletionsRange> {
    const start = parseDateOnly(input.startDate);
    const endInclusive = parseDateOnly(input.endDate);

    const startKey = toDateString(start);
    const endKey = toDateString(endInclusive);

    const cacheRead = await this.#dependencies.cache.readRange(input.userId, startKey, endKey);
    if (cacheRead.value != null) {
      return cacheRead.value;
    }

    const range = { userId: input.userId, startDate: start, endDate: addDays(1, endInclusive) };
    const [aggregates, multiDayTodos] = await Promise.all([
      this.#dependencies.repository.aggregateByDateRange(range),
      this.#dependencies.repository.findMultiDayTodos(range),
    ]);

    const result = buildDailyCompletionsRange(
      aggregates,
      { startDate: input.startDate, endDate: input.endDate },
      multiDayTodos,
    );

    await this.#dependencies.cache.storeRangeIfCurrent(
      input.userId,
      startKey,
      endKey,
      cacheRead.generation,
      result,
    );

    return result;
  }
}
