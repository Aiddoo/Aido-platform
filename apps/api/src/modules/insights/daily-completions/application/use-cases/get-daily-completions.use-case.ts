import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { tallyDailyCompletions } from "../../domain/daily-completion.domain-service.js";
import { DateRange } from "../../domain/date-range.vo.js";
import type { CompletionGroupReaderPort } from "../ports/completion-group.reader.port.js";
import type { DailyCompletionCachePort } from "../ports/daily-completion-cache.port.js";
import {
  type DailyCompletionRangeReadModel,
  toDailyCompletionRangeReadModel,
} from "../read-models/daily-completion-range.read-model.js";

export interface GetDailyCompletionsQuery {
  readonly userId: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
}

export interface GetDailyCompletionsDependencies {
  readonly completionGroupReader: Pick<CompletionGroupReaderPort, "listByDateRange">;
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

  async execute(query: GetDailyCompletionsQuery): Promise<DailyCompletionRangeReadModel> {
    const { completionGroupReader, dailyCompletionCache } = this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const range = DateRange.create(query.startDate, query.endDate);

    const cached = await dailyCompletionCache.readRange(userId, range);
    if (cached.value != null) {
      return cached.value;
    }

    const groups = await completionGroupReader.listByDateRange({ userId, range });
    const result = toDailyCompletionRangeReadModel(
      range,
      tallyDailyCompletions({ userId, range, groups }),
    );

    await dailyCompletionCache.storeRangeIfCurrent(userId, cached.generation, result);
    return result;
  }
}
