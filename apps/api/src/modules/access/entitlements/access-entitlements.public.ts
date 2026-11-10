export { assertEntitled, premiumFeatureDenied } from "./application/entitlements.errors.js";
export {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  EntitlementSubscriptionInvalidatorPort,
} from "./application/ports/entitlement-cache-invalidator.port.js";
export {
  ENTITLEMENT_READER,
  EntitlementReaderPort,
  type AccessSnapshot,
  type FeatureAccess,
} from "./application/ports/entitlement.reader.port.js";
export {
  RESOURCE_BONUS_GRANTER,
  ResourceBonusGranterPort,
} from "./application/ports/resource-bonus-granter.port.js";
export {
  calculateRemainingLimit,
  isExemptFromDormancy,
  isUnlimitedSubject,
} from "./domain/entitlement.domain-service.js";
// 여러 사용자를 한 SQL로 고르는 다른 Context의 배치 조회가 권한 판단과 같은 프리미엄 규칙을 쓰게 한다
export {
  activeSubscriptionCondition,
  freeAccessCondition,
  premiumAccessCondition,
  validStoreEntitlementCondition,
} from "./infrastructure/persistence/premium-access-condition.reader.js";
