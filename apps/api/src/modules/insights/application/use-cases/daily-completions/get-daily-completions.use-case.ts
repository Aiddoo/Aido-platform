import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";

import {
  buildDailyCompletionsRange,
  type DailyCompletionsRange,
} from "../../../domain/policies/daily-completions/daily-completion.js";
import { type DailyCompletionCachePort } from "../../ports/daily-completions/daily-completion-cache.port.js";
import { type TodoCompletionRepositoryPort } from "../../ports/daily-completions/todo-completion.repository.port.js";

export interface GetDailyCompletionsInput {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * 기간별 일일 완료 현황 조회 use-case (캘린더용, 읽기 전용).
 *
 * Cache-aside: 과거일 불변 + 투두 쓰기 이벤트가 무효화하므로 TTL 10분은 백스톱.
 */
interface GetDailyCompletionsDependencies {
  readonly repository: TodoCompletionRepositoryPort;
  readonly cache: DailyCompletionCachePort;
}

export class GetDailyCompletions {
  readonly #dependencies: GetDailyCompletionsDependencies;

  constructor(dependencies: GetDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetDailyCompletionsInput): Promise<DailyCompletionsRange> {
    const start = parseDateOnly(input.startDate);
    const endInclusive = parseDateOnly(input.endDate);

    // 캐시 키 세그먼트는 파싱된 날짜를 YYYY-MM-DD로 정규화해 사용
    const startKey = toDateString(start);
    const endKey = toDateString(endInclusive);

    const cached = await this.#dependencies.cache.getRange(input.userId, startKey, endKey);
    if (cached !== undefined) {
      return cached;
    }

    // 조회 범위를 반열림 구간 [start, end)로 변환 (종료일 포함 위해 +1일)
    const aggregates = await this.#dependencies.repository.aggregateByDateRange({
      userId: input.userId,
      startDate: start,
      endDate: addDays(1, endInclusive),
    });

    const result = buildDailyCompletionsRange(aggregates, {
      startDate: input.startDate,
      endDate: input.endDate,
    });

    await this.#dependencies.cache.setRange(input.userId, startKey, endKey, result);

    return result;
  }
}
