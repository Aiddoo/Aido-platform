export { AccessEntitlementsModule } from "./access-entitlements.module.js";
export {
  accessUserNotFound,
  assertEntitled,
  premiumFeatureDenied,
} from "./application/entitlements.errors.js";
export { AccessStateReaderPort } from "./application/ports/access-state.reader.port.js";
export { EntitlementCacheInvalidatorPort } from "./application/ports/entitlement-cache-invalidator.port.js";
export {
  EntitlementReaderPort,
  type UserEntitlements,
} from "./application/ports/entitlement.reader.port.js";
export { FeatureGranterPort } from "./application/ports/feature-granter.port.js";
export {
  toFeatureQuotaDetails,
  type FeatureQuotaDetails,
} from "./application/read-models/feature-quota.read-model.js";
export {
  calculateRemainingLimit,
  isExemptFromDormancy,
  type FeatureEntitlement,
} from "../shared/domain/entitlement.domain-service.js";
// 여러 사용자를 한 SQL로 고르는 다른 Context의 배치 조회가 권한 판단과 같은 프리미엄 규칙을 쓰게 한다
export {
  activeSubscriptionCondition,
  freeAccessCondition,
  premiumAccessCondition,
  validStoreEntitlementCondition,
} from "./infrastructure/persistence/premium-access-condition.reader.js";
