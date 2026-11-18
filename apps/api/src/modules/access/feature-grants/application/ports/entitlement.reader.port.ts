import type { MeteredFeatureKey, PlanFeature, PlanLimitFeatureKey } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FeatureQuotaReadModel } from "../read-models/feature-quota.read-model.js";
import type { UserEntitlementsReadModel } from "../read-models/user-entitlements.read-model.js";

/** 소유 Context가 사용량·개수를 세는 한도 기능 (CHEER·NUDGE·FRIEND·TODO_CATEGORY) */
export type UnmeteredLimitFeatureKey = Exclude<PlanLimitFeatureKey, MeteredFeatureKey>;

/** 소유 Context가 센 사용량. 다른 Context가 아직 Date를 쓰므로 이 경계에서 받는다. */
export interface ReportedFeatureUsage {
  readonly used: number;
  readonly resetsAt: Date | null;
}

/** 다른 Context가 권한을 묻는 문. 역할·구독 상태가 허용하는 것은 access 도메인 서비스가 판단한다. */
export abstract class EntitlementReaderPort {
  /** 카탈로그 기능을 쓸 수 있는지. quota·resource는 한도가 남았는지가 아니라 기능 자체의 허용 여부다. */
  abstract can(userId: UserId, feature: PlanFeature): Promise<boolean>;
  /** 활성 UoW에서 캐시 없이 최신 상태로 다시 판단한다. 잠금 뒤 재확인에 쓴다. */
  abstract canInTransaction(userId: UserId, feature: PlanFeature): Promise<boolean>;
  /** quota·resource 표시 한도(받은 자리 포함). null은 무제한이다. */
  abstract getFeatureLimit(userId: UserId, feature: PlanLimitFeatureKey): Promise<number | null>;
  abstract getFeatureLimitInTransaction(
    userId: UserId,
    feature: PlanLimitFeatureKey,
  ): Promise<number | null>;
  /**
   * 한도 오류 details에 싣는 서버 계산 featureQuota. 활성 UoW에서 캐시 없이 최신 권한으로 계산한다.
   * usage는 소유 Context가 센 값이다(일간 quota는 X-Timezone 하루 사용량, resource는 현재 개수).
   */
  abstract getFeatureQuotaInTransaction(
    userId: UserId,
    feature: UnmeteredLimitFeatureKey,
    usage: ReportedFeatureUsage,
  ): Promise<FeatureQuotaReadModel>;
  abstract getEntitlements(userId: UserId): Promise<UserEntitlementsReadModel>;
}
