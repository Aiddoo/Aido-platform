import type {
  MeteredFeatureKey,
  PlanQuotaFeatureKey,
  PlanResourceFeatureKey,
} from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { QuotaUsageReading } from "../../../shared/domain/entitlement.domain-service.js";

/** 계량기 없이 소유 Context가 세는 일간 quota (CHEER·NUDGE) */
type UnmeteredQuotaFeatureKey = Exclude<PlanQuotaFeatureKey, MeteredFeatureKey>;

/** Access가 셀 수 없어 소유 Context가 센 사용량 */
export interface OwnedFeatureUsage {
  /** 응원·찌르기의 오늘 사용량. 보내기 한도 검사와 같은 하루 창(요청 시간대 달력)이다. */
  readonly daily: Readonly<Record<UnmeteredQuotaFeatureKey, QuotaUsageReading>>;
  /** 친구·카테고리의 지금 개수. 친구 맺기·카테고리 만들기 한도 검사와 같은 개수다. */
  readonly resourceCounts: Readonly<Record<PlanResourceFeatureKey, number>>;
}

export abstract class OwnedFeatureUsageReaderPort {
  /** timeZone은 일간 사용량의 하루 기준(X-Timezone)이다. */
  abstract read(params: {
    readonly userId: UserId;
    readonly timeZone: string;
  }): Promise<OwnedFeatureUsage>;
}
