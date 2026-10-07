import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import { buildDailyCompletionsRange } from "../../../domain/policies/daily-completions/daily-completion.policy.js";
import type { DailyCompletionsRange } from "../../../domain/records/daily-completions/daily-completion.record.js";
import { type DailyCompletionCachePort } from "../../ports/daily-completions/daily-completion-cache.port.js";
import { type TodoCompletionRepositoryPort } from "../../ports/daily-completions/todo-completion.repository.port.js";

export interface GetDailyCompletionsInput {
  readonly userId: string;
  readonly startDate: string;
  readonly endDate: string;
}

interface GetDailyCompletionsDependencies {
  readonly repository: Pick<TodoCompletionRepositoryPort, "aggregateByDateRange">;
  readonly cache: Pick<DailyCompletionCachePort, "readRange" | "storeRangeIfCurrent">;
}

export class GetDailyCompletions {
  readonly #dependencies: GetDailyCompletionsDependencies;

  constructor(dependencies: GetDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetDailyCompletionsInput): Promise<DailyCompletionsRange> {
    const start = parseDateOnly(input.startDate);
    const endInclusive = parseDateOnly(input.endDate);

    const startKey = toDateString(start);
    const endKey = toDateString(endInclusive);

    const cacheRead = await this.#dependencies.cache.readRange(input.userId, startKey, endKey);
    if (cacheRead.value !== undefined) {
      return cacheRead.value;
    }

    const aggregates = await this.#dependencies.repository.aggregateByDateRange({
      userId: input.userId,
      startDate: start,
      endDate: addDays(1, endInclusive),
    });

    const result = buildDailyCompletionsRange(aggregates, {
      startDate: input.startDate,
      endDate: input.endDate,
    });

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
