import type { PlanFeature, PlanLimitFeatureKey } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  EntitlementReaderPort,
  type AccessSnapshot,
  type ReportedFeatureUsage,
  type UnmeteredLimitFeatureKey,
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
import {
  resolveAllFeatureAccess,
  resolveFeatureAccess,
  resolveFeatureQuota,
  type FeatureAccess,
} from "../../domain/entitlement.domain-service.js";

// 다른 Context에 여는 문. 판단은 도메인 서비스가 하고 다른 Context가 아직 쓰는 Date는 이 경계에서 바꾼다
@Injectable()
export class EntitlementReaderAdapter extends EntitlementReaderPort {
  readonly #getResolvedAccess: Pick<GetResolvedAccessUseCase, "execute">;

  constructor(getResolvedAccess: GetResolvedAccessUseCase) {
    super();
    this.#getResolvedAccess = getResolvedAccess;
  }

  async can(userId: string, feature: PlanFeature): Promise<boolean> {
    return (await this.#featureAccess(userId, feature, "cached")).allowed;
  }

  async canInTx(userId: string, feature: PlanFeature): Promise<boolean> {
    return (await this.#featureAccess(userId, feature, "latest")).allowed;
  }

  async getLimit(userId: string, feature: PlanLimitFeatureKey): Promise<number | null> {
    return (await this.#featureAccess(userId, feature, "cached")).limit;
  }

  async getLimitInTx(userId: string, feature: PlanLimitFeatureKey): Promise<number | null> {
    return (await this.#featureAccess(userId, feature, "latest")).limit;
  }

  async readFeatureQuotaInTx(
    userId: string,
    feature: UnmeteredLimitFeatureKey,
    usage: ReportedFeatureUsage,
  ): Promise<FeatureQuotaDetails> {
    const { tier, resourceBonuses } = await this.#resolve(userId, "latest");
    return toFeatureQuotaDetails(
      resolveFeatureQuota({
        tier,
        feature,
        resourceBonuses,
        usage: {
          used: usage.used,
          resetsAt: usage.resetsAt == null ? null : instantFromDate(usage.resetsAt),
        },
      }),
    );
  }

  async getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
    const { tier, isPremium, resourceBonuses } = await this.#resolve(userId, "cached");
    return { tier, isPremium, features: resolveAllFeatureAccess({ tier, resourceBonuses }) };
  }

  async #featureAccess(
    userId: string,
    feature: PlanFeature,
    consistency: AccessReadConsistency,
  ): Promise<FeatureAccess> {
    const { tier, resourceBonuses } = await this.#resolve(userId, consistency);
    return resolveFeatureAccess({ tier, feature, resourceBonuses });
  }

  #resolve(userId: string, consistency: AccessReadConsistency): Promise<ResolvedAccess> {
    return this.#getResolvedAccess.execute({ userId, consistency });
  }
}
