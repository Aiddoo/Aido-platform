import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { countCompleteDays } from "../../domain/daily-completion.domain-service.js";
import { DateRange } from "../../domain/date-range.vo.js";
import type { DailyCompletionCachePort } from "../ports/daily-completion-cache.port.js";
import type { DailyCompletionRepositoryPort } from "../ports/daily-completion.repository.port.js";
import type { DailyCompletionRange } from "../read-models/daily-completion-range.read-model.js";

export interface GetDailyCompletionsQuery {
  readonly userId: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
}

export interface GetDailyCompletionsDependencies {
  readonly dailyCompletionRepository: Pick<DailyCompletionRepositoryPort, "listByDateRange">;
  readonly dailyCompletionCache: Pick<
    DailyCompletionCachePort,
    "readRange" | "storeRangeIfCurrent"
  >;
}

export class GetDailyCompletionsUseCase {
  readonly #dependencies: GetDailyCompletionsDependencies;

  constructor(dependencies: GetDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetDailyCompletionsQuery): Promise<DailyCompletionRange> {
    const { dailyCompletionRepository, dailyCompletionCache } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const range = DateRange.create(query.startDate, query.endDate);

    const cached = await dailyCompletionCache.readRange(userId, range);
    if (cached.value != null) {
      return cached.value;
    }

    const completions = await dailyCompletionRepository.listByDateRange({ userId, range });
    const result: DailyCompletionRange = {
      range,
      completions,
      totalCompleteDays: countCompleteDays(completions),
    };

    await dailyCompletionCache.storeRangeIfCurrent(userId, cached.generation, result);
    return result;
  }
}
