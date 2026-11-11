import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailyCompletion } from "../../domain/daily-completion.entity.js";
import type { DateRange } from "../../domain/date-range.vo.js";

export interface DailyCompletionRangeQuery {
  readonly userId: UserId;
  readonly range: DateRange;
}

export abstract class DailyCompletionRepositoryPort {
  /** 구간 안 날짜별 완료 현황(날짜 오름차순). 여러 날 할 일은 기간의 모든 날에 세고 할 일이 없는 날은 빠진다 */
  abstract listByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]>;
  /** 친구에게 보이는 공개 할 일만 센다. 할 일 목록 친구 조회와 같은 공개 기준이다 */
  abstract listPublicByDateRange(query: DailyCompletionRangeQuery): Promise<DailyCompletion[]>;
}
