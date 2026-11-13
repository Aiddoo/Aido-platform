import type { PlanFeature, PlanLimitFeatureKey } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  resolveFeatureEntitlement,
  resolveFeatureEntitlements,
  resolveFeatureQuota,
  type FeatureEntitlement,
} from "../../../shared/domain/entitlement.domain-service.js";
import {
  EntitlementReaderPort,
  type ReportedFeatureUsage,
  type UnmeteredLimitFeatureKey,
  type UserEntitlements,
} from "../../application/ports/entitlement.reader.port.js";
import {
  toFeatureQuotaDetails,
  type FeatureQuotaDetails,
} from "../../application/read-models/feature-quota.read-model.js";
import type {
  AccessReadConsistency,
  ResolvedAccess,
} from "../../application/read-models/resolved-access.read-model.js";
import { GetResolvedAccessUseCase } from "../../application/use-cases/get-resolved-access.use-case.js";

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

  async canInTx(userId: UserId, feature: PlanFeature): Promise<boolean> {
    return (await this.#featureEntitlement(userId, feature, "latest")).allowed;
  }

  async getFeatureLimit(userId: UserId, feature: PlanLimitFeatureKey): Promise<number | null> {
    return (await this.#featureEntitlement(userId, feature, "cached")).limit;
  }

  async getFeatureLimitInTx(userId: UserId, feature: PlanLimitFeatureKey): Promise<number | null> {
    return (await this.#featureEntitlement(userId, feature, "latest")).limit;
  }

  async getFeatureQuotaInTx(
    userId: UserId,
    feature: UnmeteredLimitFeatureKey,
    usage: ReportedFeatureUsage,
  ): Promise<FeatureQuotaDetails> {
    const { plan, grants } = await this.#resolve(userId, "latest");
    return toFeatureQuotaDetails(
      resolveFeatureQuota({
        plan,
        feature,
        grants,
        usage: {
          used: usage.used,
          resetsAt: usage.resetsAt == null ? null : instantFromDate(usage.resetsAt),
        },
      }),
    );
  }

  async getEntitlements(userId: UserId): Promise<UserEntitlements> {
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

  #resolve(userId: UserId, consistency: AccessReadConsistency): Promise<ResolvedAccess> {
    return this.#getResolvedAccess.execute({ userId: userId.value, consistency });
  }
}
