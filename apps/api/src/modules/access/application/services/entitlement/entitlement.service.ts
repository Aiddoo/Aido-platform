import type { PremiumFeature, PremiumLimitFeatureKey } from "@aido/api/vocabulary";

import { now } from "#api/shared/domain/date/utils/core";

import {
  calculateRemainingLimit,
  NO_RESOURCE_BONUSES,
  resolveAccessTier,
  resolveAllFeatureAccess,
  resolveEffectiveSubscriptionStatus,
  resolveFeatureAccess,
  resolveFeatureLimit,
  resolveResourceLimit,
  type Feature,
  type Resource,
  type ResourceBonuses,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";
import type { EntitlementCachePort } from "../../ports/entitlement/entitlement-cache.port.js";
import type {
  AccessSnapshot,
  EntitlementReaderPort,
  FeatureEntitlement,
  ResourceEntitlement,
} from "../../ports/entitlement/entitlement-reader.port.js";
import type {
  EntitlementDatabasePort,
  EntitlementUserState,
} from "../../ports/entitlement/entitlement-state.port.js";

interface EntitlementServiceDependencies {
  readonly cacheService: EntitlementCachePort;
  readonly database: EntitlementDatabasePort;
}

/** 판단 시각의 유효 상태. 캐시도 기한을 함께 담아 TTL 안에서도 끝나는 시각을 넘기지 않는다. */
interface ResolvedUserState {
  readonly role: string;
  readonly subscriptionStatus: string;
  readonly resourceBonuses: ResourceBonuses;
}

export class EntitlementService implements EntitlementReaderPort {
  readonly #dependencies: EntitlementServiceDependencies;

  constructor(dependencies: EntitlementServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async getFeatureLimit(userId: string, feature: Feature): Promise<FeatureEntitlement> {
    return this.#featureLimit(await this.#cachedUserState(userId), feature);
  }

  async getFeatureLimitInTx(userId: string, feature: Feature): Promise<FeatureEntitlement> {
    return this.#featureLimit(await this.#freshUserState(userId), feature);
  }

  async getResourceLimit(userId: string, resource: Resource): Promise<ResourceEntitlement> {
    return this.#resourceLimit(await this.#cachedUserState(userId), resource);
  }

  async getResourceLimitInTx(userId: string, resource: Resource): Promise<ResourceEntitlement> {
    return this.#resourceLimit(await this.#freshUserState(userId), resource);
  }

  calculateRemaining(dailyLimit: number | null, used: number): number | null {
    return calculateRemainingLimit(dailyLimit, used);
  }

  async can(userId: string, feature: PremiumFeature): Promise<boolean> {
    return this.#featureAccess(await this.#cachedUserState(userId), feature).allowed;
  }

  async canInTx(userId: string, feature: PremiumFeature): Promise<boolean> {
    return this.#featureAccess(await this.#freshUserState(userId), feature).allowed;
  }

  async limitOf(userId: string, feature: PremiumLimitFeatureKey): Promise<number | null> {
    return this.#featureAccess(await this.#cachedUserState(userId), feature).limit;
  }

  async limitOfInTx(userId: string, feature: PremiumLimitFeatureKey): Promise<number | null> {
    return this.#featureAccess(await this.#freshUserState(userId), feature).limit;
  }

  async getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
    const user = await this.#cachedUserState(userId);
    const tier = resolveAccessTier(user.role, user.subscriptionStatus);
    return {
      tier,
      isPremium: user.subscriptionStatus === "ACTIVE",
      features: resolveAllFeatureAccess(tier, user.resourceBonuses),
    };
  }

  #featureAccess(user: ResolvedUserState, feature: PremiumFeature) {
    return resolveFeatureAccess(
      resolveAccessTier(user.role, user.subscriptionStatus),
      feature,
      user.resourceBonuses,
    );
  }

  #featureLimit(user: ResolvedUserState, feature: Feature): FeatureEntitlement {
    return {
      dailyLimit: resolveFeatureLimit(user.role, user.subscriptionStatus, feature),
      isAdmin: user.role === "ADMIN",
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  #resourceLimit(user: ResolvedUserState, resource: Resource): ResourceEntitlement {
    return {
      maxCount: resolveResourceLimit(
        user.role,
        user.subscriptionStatus,
        resource,
        user.resourceBonuses[resource],
      ),
      isAdmin: user.role === "ADMIN",
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  async #freshUserState(userId: string): Promise<ResolvedUserState> {
    const [found, resourceBonuses] = await Promise.all([
      this.#dependencies.database.findUserState(userId),
      this.#dependencies.database.findResourceBonuses(userId),
    ]);
    const user: EntitlementUserState = found ?? {
      role: "USER",
      subscriptionStatus: "FREE",
      accessDeadline: null,
    };
    return {
      role: user.role,
      subscriptionStatus: resolveEffectiveSubscriptionStatus(
        user.subscriptionStatus,
        user.accessDeadline,
        now(),
      ),
      resourceBonuses,
    };
  }

  async #cachedUserState(userId: string): Promise<ResolvedUserState> {
    const cached = await this.#dependencies.cacheService.wrapSubscription(userId, async () => {
      const [user, resourceBonuses] = await Promise.all([
        this.#dependencies.database.findUserState(userId),
        this.#dependencies.database.findResourceBonuses(userId),
      ]);
      return {
        status: user?.subscriptionStatus ?? null,
        isAdmin: user?.role === "ADMIN",
        accessDeadlineMs: user?.accessDeadline?.getTime() ?? null,
        resourceBonuses,
      };
    });
    const deadlineMs = cached?.accessDeadlineMs;
    return {
      role: cached?.isAdmin === true ? "ADMIN" : "USER",
      subscriptionStatus: resolveEffectiveSubscriptionStatus(
        cached?.status ?? "FREE",
        deadlineMs == null ? null : new Date(deadlineMs),
        now(),
      ),
      resourceBonuses: cached?.resourceBonuses ?? NO_RESOURCE_BONUSES,
    };
  }
}
