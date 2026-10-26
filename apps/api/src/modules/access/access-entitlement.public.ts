export {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "./application/ports/entitlement/entitlement-reader.port.js";
export {
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  type EntitlementSubscriptionInvalidatorPort,
} from "./application/ports/entitlement/subscription-cache-invalidator.port.js";
export {
  RESOURCE_BONUS_GRANTER,
  type GrantResourceBonusInput,
  type ResourceBonusGranterPort,
} from "./application/ports/entitlement/resource-bonus-granter.port.js";
export { Feature, Resource } from "./domain/policies/entitlement/entitlement-limits.policy.js";
export { AccessModule } from "./access.module.js";
