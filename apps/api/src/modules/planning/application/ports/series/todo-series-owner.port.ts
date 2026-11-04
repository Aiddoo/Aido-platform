import type { SeriesOwnerActivity } from "../../../domain/policies/series/series-dormancy.policy.js";

export const TODO_SERIES_OWNER = Symbol("TODO_SERIES_OWNER");

export interface TodoSeriesOwnerPort {
  /** 회차를 채울 수 있는 소유자의 활동 기록. 정지·탈퇴 대기 계정은 결과에 없다. */
  findOperatingOwners(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>>;

  /** 유효한 스토어 구독이나 보상 기간이 있는지. 유료 사용자는 앱을 안 열어도 멈추지 않는다. */
  hasPaidAccess(userId: string): Promise<boolean>;
}
