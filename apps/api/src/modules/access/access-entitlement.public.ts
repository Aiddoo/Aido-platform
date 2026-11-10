export {
  ENTITLEMENT_READER,
  type AccessSnapshot,
  type EntitlementReaderPort,
  type FeatureAccess,
} from "./entitlements/application/ports/entitlement.reader.port.js";
export {
  assertEntitled,
  assertEntitledInTx,
  premiumFeatureDenied,
} from "./entitlements/application/entitlements.errors.js";
export {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  type EntitlementSubscriptionInvalidatorPort,
} from "./entitlements/application/ports/entitlement-cache-invalidator.port.js";
export {
  RESOURCE_BONUS_GRANTER,
  type GrantResourceBonusInput,
  type ResourceBonusGranterPort,
} from "./entitlements/application/ports/resource-bonus-granter.port.js";
export {
  calculateRemainingLimit,
  isExemptFromDormancy,
  isExemptFromUserSpendLimit,
} from "./entitlements/domain/entitlement.domain-service.js";
export { AccessModule } from "./access.module.js";
