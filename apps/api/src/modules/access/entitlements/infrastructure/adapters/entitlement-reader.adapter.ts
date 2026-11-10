import type { FeatureQuota } from "@aido/api";
import type { PlanFeature, PlanLimitFeatureKey } from "@aido/api/vocabulary";

import { now } from "#api/shared/domain/date/utils/core";

import type { AccessStateReaderPort } from "../../application/ports/access-state.reader.port.js";
import type { EntitlementCachePort } from "../../application/ports/entitlement-cache.port.js";
import type {
  AccessSnapshot,
  EntitlementReaderPort,
  UnmeteredLimitFeatureKey,
} from "../../application/ports/entitlement.reader.port.js";
import { toFeatureQuota } from "../../application/read-models/feature-quota.read-model.js";
import {
  NO_RESOURCE_BONUSES,
  resolveAccessContext,
  resolveAllFeatureAccess,
  resolveFeatureAccess,
  resolveFeatureQuota,
  type AccessContext,
  type FeatureUsageReading,
  type ResourceBonuses,
} from "../../domain/entitlement.domain-service.js";

interface EntitlementReaderAdapterDependencies {
  readonly cacheService: EntitlementCachePort;
  readonly database: AccessStateReaderPort;
}

/** 판단 시각의 접근 주체. 캐시도 기한을 함께 담아 TTL 안에서도 끝나는 시각을 넘기지 않는다. */
interface ResolvedAccess {
  readonly context: AccessContext;
  readonly resourceBonuses: ResourceBonuses;
}

export class EntitlementReaderAdapter implements EntitlementReaderPort {
  readonly #dependencies: EntitlementReaderAdapterDependencies;

  constructor(dependencies: EntitlementReaderAdapterDependencies) {
    this.#dependencies = dependencies;
  }

  async can(userId: string, feature: PlanFeature): Promise<boolean> {
    return this.#featureAccess(await this.#cachedAccess(userId), feature).allowed;
  }

  async canInTx(userId: string, feature: PlanFeature): Promise<boolean> {
    return this.#featureAccess(await this.#freshAccess(userId), feature).allowed;
  }

  async getLimit(userId: string, feature: PlanLimitFeatureKey): Promise<number | null> {
    return this.#featureAccess(await this.#cachedAccess(userId), feature).limit;
  }

  async getLimitInTx(userId: string, feature: PlanLimitFeatureKey): Promise<number | null> {
    return this.#featureAccess(await this.#freshAccess(userId), feature).limit;
  }

  async readFeatureQuotaInTx(
    userId: string,
    feature: UnmeteredLimitFeatureKey,
    usage: FeatureUsageReading,
  ): Promise<FeatureQuota> {
    const { context, resourceBonuses } = await this.#freshAccess(userId);
    return toFeatureQuota(
      resolveFeatureQuota({ tier: context.tier, feature, resourceBonuses, usage }),
    );
  }

  async getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
    const { context, resourceBonuses } = await this.#cachedAccess(userId);
    return {
      tier: context.tier,
      isPremium: context.isPremium,
      features: resolveAllFeatureAccess(context.tier, resourceBonuses),
    };
  }

  #featureAccess(access: ResolvedAccess, feature: PlanFeature) {
    return resolveFeatureAccess(access.context.tier, feature, access.resourceBonuses);
  }

  async #freshAccess(userId: string): Promise<ResolvedAccess> {
    const [found, resourceBonuses] = await Promise.all([
      this.#dependencies.database.findUserState(userId),
      this.#dependencies.database.findResourceBonuses(userId),
    ]);
    return {
      context: resolveAccessContext(
        found ?? { role: "USER", subscriptionStatus: "FREE", accessDeadline: null },
        now(),
      ),
      resourceBonuses,
    };
  }

  async #cachedAccess(userId: string): Promise<ResolvedAccess> {
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
      context: resolveAccessContext(
        {
          role: cached?.isAdmin === true ? "ADMIN" : "USER",
          subscriptionStatus: cached?.status ?? "FREE",
          accessDeadline: deadlineMs == null ? null : new Date(deadlineMs),
        },
        now(),
      ),
      resourceBonuses: cached?.resourceBonuses ?? NO_RESOURCE_BONUSES,
    };
  }
}
