import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCompletionGroup } from "../../domain/daily-completion.domain-service.js";
import type { DateRange } from "../../domain/date-range.vo.js";

export interface CompletionGroupQuery {
  readonly userId: UserId;
  readonly range: DateRange;
}

// 할 일은 planning이 소유해 구간에 걸친 할 일 묶음만 받고 날짜별로 펼치는 일은 tallyDailyCompletions가 한다
export abstract class CompletionGroupReaderPort {
  abstract listByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]>;
  /** 친구에게 보이는 공개 할 일만 묶는다. 할 일 목록 친구 조회와 같은 공개 기준이다 */
  abstract listPublicByDateRange(query: CompletionGroupQuery): Promise<TodoCompletionGroup[]>;
}
