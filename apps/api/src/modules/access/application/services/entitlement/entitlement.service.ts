import {
  calculateRemainingLimit,
  hasPremiumEntitlement,
  resolveFeatureLimit,
  resolveResourceLimit,
  type Feature,
  type Resource,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";
import type { EntitlementCachePort } from "../../ports/entitlement/entitlement-cache.port.js";
import type {
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

  async hasPremiumAccess(userId: string): Promise<boolean> {
    const user = await this.#cachedUserState(userId);
    return hasPremiumEntitlement(user.role, user.subscriptionStatus);
  }

  async hasPremiumAccessInTx(userId: string): Promise<boolean> {
    const user = await this.#freshUserState(userId);
    return hasPremiumEntitlement(user.role, user.subscriptionStatus);
  }

  calculateRemaining(dailyLimit: number | null, used: number): number | null {
    return calculateRemainingLimit(dailyLimit, used);
  }

  #featureLimit(user: EntitlementUserState, feature: Feature): FeatureEntitlement {
    return {
      dailyLimit: resolveFeatureLimit(user.role, user.subscriptionStatus, feature),
      isAdmin: user.role === "ADMIN",
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  #resourceLimit(user: EntitlementUserState, resource: Resource): ResourceEntitlement {
    return {
      maxCount: resolveResourceLimit(user.role, user.subscriptionStatus, resource),
      isAdmin: user.role === "ADMIN",
      subscriptionStatus: user.subscriptionStatus,
    };
  }

  async #freshUserState(userId: string): Promise<EntitlementUserState> {
    return (
      (await this.#dependencies.database.findUserState(userId)) ?? {
        role: "USER",
        subscriptionStatus: "FREE",
      }
    );
  }

  async #cachedUserState(userId: string): Promise<EntitlementUserState> {
    const cached = await this.#dependencies.cacheService.wrapSubscription(userId, async () => {
      const user = await this.#dependencies.database.findUserState(userId);
      return { status: user?.subscriptionStatus ?? null, isAdmin: user?.role === "ADMIN" };
    });
    return {
      role: cached?.isAdmin === true ? "ADMIN" : "USER",
      subscriptionStatus: cached?.status ?? "FREE",
    };
  }
}
