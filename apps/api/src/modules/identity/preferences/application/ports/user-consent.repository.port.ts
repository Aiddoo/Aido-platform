import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";
import type { UserConsentRecord } from "../../domain/user-consent.constants.js";

/** 배치 조회용 동의 레코드 (사용자 식별자 포함). */
export type UserConsentRecordWithId = UserConsentRecord & { userId: string };

/** 회원가입 시 시딩할 초기 약관 동의 값 (auth 프로비저닝 경로). */
export interface ConsentSeedInput {
  termsAgreedAt?: Temporal.Instant;
  privacyAgreedAt?: Temporal.Instant;
  agreedTermsVersion?: string;
  marketingAgreedAt?: Temporal.Instant | null;
  marketingPushAgreedAt?: Temporal.Instant | null;
}

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

/**
 * 약관 동의 리포지토리 포트.
 */
export abstract class UserConsentRepositoryPort {
  abstract findByUserId(userId: UserId): Promise<UserConsentRecord | null>;
  /** 동의 행이 없으면 아직 답하지 않은 동의다 */
  abstract findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent>;
  abstract findByUserIds(userIds: readonly UserId[]): Promise<UserConsentRecordWithId[]>;
  abstract create(userId: UserId, data: ConsentSeedInput): Promise<UserConsentRecord>;
  abstract upsertMarketingConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRecord>;
  abstract upsertMarketingPushConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null },
  ): Promise<UserConsentRecord>;
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
  /** 동의하면 agreedAt에 시각, 거부·철회하면 null을 쓰고 답한 안내 version을 함께 남긴다. */
  abstract upsertAiDataSharingConsent(
    userId: UserId,
    data: { agreedAt: Temporal.Instant | null; version: string },
  ): Promise<UserConsentRecord>;
}
