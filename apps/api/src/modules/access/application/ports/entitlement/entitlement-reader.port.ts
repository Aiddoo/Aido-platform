import type {
  Feature,
  Resource,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

export interface FeatureEntitlement {
  dailyLimit: number | null;
  isAdmin: boolean;
  subscriptionStatus: string;
}

export interface ResourceEntitlement {
  maxCount: number | null;
  isAdmin: boolean;
  subscriptionStatus: string;
}

export const ENTITLEMENT_READER = Symbol("ENTITLEMENT_READER");

export interface EntitlementReaderPort {
  getFeatureLimit(userId: string, feature: Feature): Promise<FeatureEntitlement>;
  getFeatureLimitInTx(userId: string, feature: Feature): Promise<FeatureEntitlement>;
  getResourceLimit(userId: string, resource: Resource): Promise<ResourceEntitlement>;
  getResourceLimitInTx(userId: string, resource: Resource): Promise<ResourceEntitlement>;
  hasPremiumAccess(userId: string): Promise<boolean>;
  hasPremiumAccessInTx(userId: string): Promise<boolean>;
  calculateRemaining(dailyLimit: number | null, used: number): number | null;
}
