export { AccessEntitlementsModule } from "./access-entitlements.module.js";
export { assertEntitled, premiumFeatureDenied } from "./application/entitlements.errors.js";
export { EntitlementCacheInvalidatorPort } from "./application/ports/entitlement-cache-invalidator.port.js";
export {
  EntitlementReaderPort,
  type FeatureEntitlement,
  type UserEntitlements,
} from "./application/ports/entitlement.reader.port.js";
export {
  FeatureGranterPort,
  type FeatureGrantInput,
} from "./application/ports/feature-granter.port.js";
export {
  calculateRemainingLimit,
  isExemptFromDormancy,
} from "./domain/entitlement.domain-service.js";
// 여러 사용자를 한 SQL로 고르는 다른 Context의 배치 조회가 권한 판단과 같은 프리미엄 규칙을 쓰게 한다
export {
  activeSubscriptionCondition,
  freeAccessCondition,
  premiumAccessCondition,
  validStoreEntitlementCondition,
} from "./infrastructure/persistence/premium-access-condition.reader.js";
