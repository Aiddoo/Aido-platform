import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";
import type { UserConsentReadModel } from "../read-models/consent.read-model.js";

/** 광고성 수신 동의 사실을 다시 알릴 사용자 */
export interface MarketingReconfirmTarget {
  readonly userId: string;
  readonly marketingAgreedAt: Temporal.Instant | null;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
}

export interface FindMarketingReconfirmTargetsParams {
  /** 이 시각 이전에 동의했거나 마지막으로 알린 사용자 */
  readonly cutoff: Temporal.Instant;
  readonly afterUserId?: UserId;
  readonly limit: number;
}

/** 동의 읽기와 재확인 묶음 기록. 동의 변경은 UserPreference 저장이 쓴다 */
export abstract class UserConsentRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<UserConsentReadModel | null>;
  /** 동의 행이 없으면 아직 답하지 않은 동의다 */
  abstract findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent>;
  abstract findByUserIds(userIds: readonly UserId[]): Promise<UserConsentReadModel[]>;
  /** 활성 사용자 중 광고성 동의(또는 마지막 재확인)가 cutoff 이전인 사용자를 userId 순으로 읽는다. */
  abstract findMarketingReconfirmTargets(
    params: FindMarketingReconfirmTargetsParams,
  ): Promise<MarketingReconfirmTarget[]>;
  /**
   * 아직 대상인 사용자만 재확인 시각을 기록하고 기록한 사용자를 돌려준다. 두 실행이 같은 사용자를 고르면
   * 행 잠금 뒤 조건을 다시 보므로 한 실행만 얻는다.
   */
  abstract claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmTarget[]>;
}
