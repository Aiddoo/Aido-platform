import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { StoreSubscriptionEntitlement } from "../../../shared/domain/premium-access.domain-service.js";

/** 사용자가 소유한 삭제되지 않은 스토어 구독 행. 프리미엄 판단은 subscriptions slice의 행을 읽기만 한다. */
export abstract class StoreEntitlementReaderPort {
  abstract listByUserId(userId: UserId): Promise<StoreSubscriptionEntitlement[]>;
}
