import type { GrantableFeature } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

const FEATURE_GRANT_STATUSES = ["granted", "duplicate"] as const;

export interface FeatureGrantInput {
  readonly userId: UserId;
  readonly feature: GrantableFeature;
  /** 더할 자리 수. 1 이상의 정수다 */
  readonly quantity: number;
  /** 같은 보상을 두 번 지급하지 않게 하는 출처 키 */
  readonly sourceKey: string;
}

export interface FeatureGrantResult {
  readonly status: (typeof FEATURE_GRANT_STATUSES)[number];
}

/** 기능 한도에 자리를 더한다. 호출자의 UoW에 참여하고 권한 캐시는 커밋 뒤 비운다. */
export abstract class FeatureGranterPort {
  abstract grant(input: FeatureGrantInput): Promise<FeatureGrantResult>;
}
