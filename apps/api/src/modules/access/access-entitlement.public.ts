export {
  ENTITLEMENT_READER,
  type AccessSnapshot,
  type EntitlementReaderPort,
  type FeatureAccess,
} from "./application/ports/entitlement/entitlement-reader.port.js";
export {
  assertEntitled,
  assertEntitledInTx,
  premiumFeatureDenied,
} from "./application/services/entitlement/entitlement-guard.js";
export {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  type EntitlementSubscriptionInvalidatorPort,
} from "./application/ports/entitlement/subscription-cache-invalidator.port.js";
export {
  RESOURCE_BONUS_GRANTER,
  type GrantResourceBonusInput,
  type ResourceBonusGranterPort,
} from "./application/ports/entitlement/resource-bonus-granter.port.js";
export {
  calculateRemainingLimit,
  isExemptFromDormancy,
  isExemptFromUserSpendLimit,
} from "./domain/policies/entitlement/entitlement.policy.js";
export { AccessModule } from "./access.module.js";
