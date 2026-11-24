import type { PlanFeature, PlanHorizonFeatureKey, PlanLimitFeatureKey } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  resolveFeatureEntitlement,
  resolveFeatureEntitlements,
  resolveFeatureQuota,
  resolveHorizonDays,
  type FeatureEntitlement,
} from "../../../shared/domain/entitlement.domain-service.js";
import {
  EntitlementReaderPort,
  type ReportedFeatureUsage,
  type UnmeteredLimitFeatureKey,
} from "../../application/ports/entitlement.reader.port.js";
import {
  toFeatureQuotaReadModel,
  type FeatureQuotaReadModel,
} from "../../application/read-models/feature-quota.read-model.js";
import type { ResolvedAccessReadModel } from "../../application/read-models/resolved-access.read-model.js";
import type { UserEntitlementsReadModel } from "../../application/read-models/user-entitlements.read-model.js";
import {
  type AccessReadConsistency,
  GetResolvedAccessUseCase,
} from "../../application/use-cases/get-resolved-access.use-case.js";

// 다른 Context에 여는 문. 판단은 도메인 서비스가 하고 다른 Context가 아직 쓰는 Date는 이 경계에서 바꾼다
@Injectable()
export class EntitlementReaderAdapter implements EntitlementReaderPort {
  readonly #getResolvedAccess: Pick<GetResolvedAccessUseCase, "execute">;

  constructor(getResolvedAccess: GetResolvedAccessUseCase) {
    this.#getResolvedAccess = getResolvedAccess;
  }

  async can(userId: UserId, feature: PlanFeature): Promise<boolean> {
    return (await this.#featureEntitlement(userId, feature, "cached")).allowed;
  }

  async canInTransaction(userId: UserId, feature: PlanFeature): Promise<boolean> {
    return (await this.#featureEntitlement(userId, feature, "latest")).allowed;
  }

  async findFeatureLimit(userId: UserId, feature: PlanLimitFeatureKey): Promise<number | null> {
    return (await this.#featureEntitlement(userId, feature, "cached")).limit;
  }

  async findFeatureLimitInTransaction(
    userId: UserId,
    feature: PlanLimitFeatureKey,
  ): Promise<number | null> {
    return (await this.#featureEntitlement(userId, feature, "latest")).limit;
  }

  async getHorizonDays(userId: UserId, feature: PlanHorizonFeatureKey): Promise<number> {
    const { plan } = await this.#resolve(userId, "cached");
    return resolveHorizonDays({ plan, feature });
  }

  async getHorizonDaysInTransaction(
    userId: UserId,
    feature: PlanHorizonFeatureKey,
  ): Promise<number> {
    const { plan } = await this.#resolve(userId, "latest");
    return resolveHorizonDays({ plan, feature });
  }

  async getFeatureQuotaInTransaction(
    userId: UserId,
    feature: UnmeteredLimitFeatureKey | PlanHorizonFeatureKey,
    usage: ReportedFeatureUsage | null,
  ): Promise<FeatureQuotaReadModel> {
    const { plan, grants } = await this.#resolve(userId, "latest");
    return toFeatureQuotaReadModel(
      resolveFeatureQuota({
        plan,
        feature,
        grants,
        usage:
          usage == null
            ? null
            : {
                used: usage.used,
                resetsAt: usage.resetsAt == null ? null : instantFromDate(usage.resetsAt),
              },
      }),
    );
  }

  async getEntitlements(userId: UserId): Promise<UserEntitlementsReadModel> {
    const { tier, plan, isPremium, grants } = await this.#resolve(userId, "cached");
    return { tier, plan, isPremium, features: resolveFeatureEntitlements({ plan, grants }) };
  }

  async #featureEntitlement(
    userId: UserId,
    feature: PlanFeature,
    consistency: AccessReadConsistency,
  ): Promise<FeatureEntitlement> {
    const { plan, grants } = await this.#resolve(userId, consistency);
    return resolveFeatureEntitlement({ plan, feature, grants });
  }

  #resolve(userId: UserId, consistency: AccessReadConsistency): Promise<ResolvedAccessReadModel> {
    return this.#getResolvedAccess.execute({ userId, consistency });
  }
}
