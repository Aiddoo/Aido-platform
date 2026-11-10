export const MARKETING_CONSENT_RECONFIRM_ACCESS = Symbol("MARKETING_CONSENT_RECONFIRM_ACCESS");

/** 광고성 수신 동의 사실을 다시 알릴 사용자와 동의 시각 */
export interface MarketingReconfirmRecipient {
  readonly userId: string;
  readonly marketingAgreedAt: Date | null;
  readonly marketingPushAgreedAt: Date | null;
}

/** 2년 재확인 대상 조회·표시 capability (identity 동의 기록에 연결). */
export interface MarketingConsentReconfirmPort {
  /** 활성 사용자 중 광고성 동의(또는 마지막 재확인)가 cutoff 이전인 사용자를 userId 순으로 읽는다. */
  findMarketingReconfirmTargets(params: {
    readonly cutoff: Date;
    readonly afterUserId?: string;
    readonly limit: number;
  }): Promise<MarketingReconfirmRecipient[]>;
  /** 아직 대상인 사용자만 재확인 시각을 기록하고 기록한 사용자를 돌려준다(조건부 UPDATE). */
  claimMarketingReconfirm(
    userIds: readonly string[],
    params: { readonly cutoff: Date; readonly at: Date },
  ): Promise<MarketingReconfirmRecipient[]>;
}
