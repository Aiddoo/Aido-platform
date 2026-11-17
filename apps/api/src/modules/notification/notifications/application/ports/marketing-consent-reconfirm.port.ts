import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface MarketingReconfirmRecipient {
  readonly userId: string;
  readonly marketingAgreedAt: Temporal.Instant | null;
  readonly marketingPushAgreedAt: Temporal.Instant | null;
}

// 광고성 수신 동의 2년 재확인 대상 조회·표시(identity 동의 기록에 연결)
export abstract class MarketingConsentReconfirmPort {
  // 활성 사용자 중 광고성 동의(또는 마지막 재확인)가 cutoff 이전인 사용자를 userId 순으로 읽는다
  abstract findMarketingReconfirmTargets(params: {
    readonly cutoff: Temporal.Instant;
    readonly afterUserId?: UserId;
    readonly limit: number;
  }): Promise<MarketingReconfirmRecipient[]>;
  // 아직 대상인 사용자만 재확인 시각을 기록하고 기록한 사용자를 돌려준다(조건부 UPDATE)
  abstract claimMarketingReconfirm(
    userIds: readonly UserId[],
    params: { readonly cutoff: Temporal.Instant; readonly at: Temporal.Instant },
  ): Promise<MarketingReconfirmRecipient[]>;
}
