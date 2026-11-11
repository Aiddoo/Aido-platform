import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SeriesOwnerActivity } from "../../domain/series-dormancy.domain-service.js";

export abstract class TodoSeriesOwnerPort {
  /** 회차를 채울 수 있는 소유자의 활동 기록. 정지·탈퇴 대기 계정은 결과에 없다. */
  abstract findOperatingOwners(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>>;

  /** 유료·ADMIN은 앱을 안 열어도 멈추지 않는다. 판단은 access 정책이 소유한다. */
  abstract isExemptFromDormancy(userId: UserId): Promise<boolean>;
}
