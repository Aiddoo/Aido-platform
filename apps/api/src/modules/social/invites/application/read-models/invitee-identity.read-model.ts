/** 같은 신원 중복 보상을 판단하는 초대받은 사람 정보. 원문은 해시로만 쓰고 저장하지 않는다. */
export interface InviteeIdentity {
  readonly userId: string;
  /** 알림 문구용 이름. 이름이 없으면 사용자 태그다. */
  readonly displayName: string;
  /** 가입 시각 */
  readonly joinedAt: Temporal.Instant;
  /** 인증을 마친 이메일. 인증 전이면 null */
  readonly verifiedEmail: string | null;
  readonly providerAccounts: readonly {
    readonly provider: string;
    readonly providerAccountId: string;
  }[];
}
