import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FeatureGrants } from "../../../shared/domain/access.constants.js";

/** 캐시에 담는 권한 상태. 캐시 key v2의 값 모양이라 필드 이름을 바꾸지 않는다(resourceBonuses = 받은 자리). */
export interface CachedAccessState {
  readonly status: string | null;
  readonly isAdmin: boolean;
  /** 1.13.0 이전 캐시에는 없다. 없으면 기한 없이 status를 그대로 쓴다. */
  readonly accessDeadlineMs?: number | null;
  readonly resourceBonuses: FeatureGrants;
}

export abstract class EntitlementCachePort {
  /** 캐시에 없으면 factory 값을 저장하고 돌려준다. 캐시를 읽지 못하면 null이다. */
  abstract wrap(
    userId: UserId,
    factory: () => Promise<CachedAccessState>,
  ): Promise<CachedAccessState | null>;
  abstract invalidate(userId: UserId): Promise<void>;
}
