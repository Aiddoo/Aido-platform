import { PLAN_CATALOG, type PlanFeature } from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";

import {
  accessUserNotFound,
  type AccessStateReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { QuotaUsageRepositoryPort } from "#api/modules/access/quotas/access-quotas.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  resolveAccessSubject,
  resolveFeatureQuota,
  resolveResourceUsage,
  type FeatureUsageReading,
} from "../../../shared/domain/entitlement.domain-service.js";
import { QuotaWindow } from "../../../shared/domain/quota-window.vo.js";
import type { OwnedFeatureUsageReaderPort } from "../ports/owned-feature-usage.reader.port.js";
import type { EntitlementUsageReadModel } from "../read-models/entitlement-usage.read-model.js";

export interface GetEntitlementUsageQuery {
  readonly userId: string;
  /** 응원·찌르기 일간 사용량의 하루 기준(X-Timezone) */
  readonly timeZone: string;
}

export interface GetEntitlementUsageDependencies {
  readonly accessStateReader: Pick<AccessStateReaderPort, "findAccessState" | "findFeatureGrants">;
  readonly quotaUsageRepository: Pick<QuotaUsageRepositoryPort, "countUsage">;
  readonly ownedFeatureUsageReader: OwnedFeatureUsageReaderPort;
  readonly clock: ClockPort;
}

/**
 * GET /v1/entitlements. 한도·계량기 사용량은 Access가 계산하고, Access가 셀 수 없는 응원·찌르기 일간 사용량과
 * 친구·카테고리 개수는 소유 Context가 센 값을 받는다. 개수는 친구 맺기·카테고리 만들기 한도 검사와 같은 값이라
 * 앱이 한도에 닿은 것을 입력 전에 안다.
 */
export class GetEntitlementUsageUseCase {
  readonly #dependencies: GetEntitlementUsageDependencies;

  constructor(dependencies: GetEntitlementUsageDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetEntitlementUsageQuery): Promise<EntitlementUsageReadModel> {
    const { accessStateReader, quotaUsageRepository, ownedFeatureUsageReader, clock } =
      this.#dependencies;
    const userId = UserId.reconstitute(query.userId);
    const ownedUsage = await ownedFeatureUsageReader.read({ userId, timeZone: query.timeZone });
    const [state, grants] = await Promise.all([
      accessStateReader.findAccessState(userId),
      accessStateReader.findFeatureGrants(userId),
    ]);
    if (state == null) {
      throw accessUserNotFound(query.userId);
    }

    const now = clock.now();
    const subject = resolveAccessSubject({ state, now });
    const { plan } = subject;
    const window = QuotaWindow.create(now);
    const [aiPlanUsed, voiceNoteUsed] = await Promise.all([
      quotaUsageRepository.countUsage({ userId, meter: "AI_PLAN", window }),
      quotaUsageRepository.countUsage({ userId, meter: "VOICE_NOTE", window }),
    ]);
    const resourceUsage = mapValues(ownedUsage.resourceCounts, (count, feature) =>
      resolveResourceUsage({ plan, feature, grants, count }),
    );
    const usage: Readonly<Partial<Record<PlanFeature, FeatureUsageReading | null>>> = {
      ...ownedUsage.daily,
      ...resourceUsage,
      AI_PARSE: { used: aiPlanUsed, resetsAt: window.resetsAt },
      VOICE_NOTE: { used: voiceNoteUsed, resetsAt: window.resetsAt },
    };

    return {
      ...subject,
      features: mapValues(PLAN_CATALOG, (_definition, feature) =>
        resolveFeatureQuota({ plan, feature, grants, usage: usage[feature] ?? null }),
      ),
    };
  }
}
