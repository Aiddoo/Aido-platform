import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DateRange } from "../../domain/date-range.vo.js";
import type { DailyCompletionRange } from "../read-models/daily-completion-range.read-model.js";

export interface DailyCompletionCacheRead {
  /** 읽은 시점의 사용자 캐시 세대. 같은 세대일 때만 저장해 무효화 뒤 늦게 끝난 조회가 덮어쓰지 않는다 */
  readonly generation: string;
  readonly value: DailyCompletionRange | null;
}

/** 본인 조회와 친구(공개) 조회를 나눠 담고, 할 일이 바뀌면 사용자 단위로 모두 버린다 */
export abstract class DailyCompletionCachePort {
  abstract readRange(userId: UserId, range: DateRange): Promise<DailyCompletionCacheRead>;
  abstract storeRangeIfCurrent(
    userId: UserId,
    generation: string,
    value: DailyCompletionRange,
  ): Promise<void>;
  abstract readPublicRange(
    ownerUserId: UserId,
    range: DateRange,
  ): Promise<DailyCompletionCacheRead>;
  abstract storePublicRangeIfCurrent(
    ownerUserId: UserId,
    generation: string,
    value: DailyCompletionRange,
  ): Promise<void>;
  abstract invalidate(userId: UserId): Promise<void>;
}
