// 아직 옮기지 않은 소비 Context가 쓰는 옛 진입점. 새 코드는 entitlements/access-entitlements.public.ts를 쓴다
export {
  ENTITLEMENT_READER,
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  RESOURCE_BONUS_GRANTER,
  assertEntitled,
  calculateRemainingLimit,
  isExemptFromDormancy,
  premiumFeatureDenied,
  type AccessSnapshot,
  type EntitlementReaderPort,
  type EntitlementSubscriptionInvalidatorPort,
  type FeatureAccess,
  type ResourceBonusGranterPort,
} from "./entitlements/access-entitlements.public.js";
// 옛 이름 AccessModule은 원장 모듈이다. 원장 모듈이 권한 모듈까지 다시 내보낸다
export { AccessQuotasModule as AccessModule } from "./quotas/access-quotas.public.js";
