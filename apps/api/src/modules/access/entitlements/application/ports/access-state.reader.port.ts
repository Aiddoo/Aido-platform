import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccessState } from "../../domain/entitlement.domain-service.js";
import type { FeatureGrants } from "../../domain/entitlements.constants.js";

/** 권한 판단에 필요한 사용자 상태. 저장된 구독 projection과 스토어 유예로 끝나는 시각을 함께 읽는다. */
export abstract class AccessStateReaderPort {
  /** 활성이고 지우지 않은 사용자만 돌려준다. 없으면 null이고 무료로 판단한다. */
  abstract findActiveUserAccessState(userId: UserId): Promise<AccessState | null>;
  /** 계정 상태와 무관하게 사용자가 있으면 돌려준다. 원장이 사용자 잠금 안에서 쓴다. */
  abstract findAccessState(userId: UserId): Promise<AccessState | null>;
  /** 기능별로 받은 자리 합계. 1 이상인 지급만 더하고 받은 것이 없는 기능은 키가 없다. */
  abstract findFeatureGrants(userId: UserId): Promise<FeatureGrants>;
}
