export type RewardClaimKind = "INSTALLATION" | "IDENTITY";

/** 같은 기기·같은 신원의 보상 이력. 탈퇴해도 남아 재가입 남용을 막는다. */
export interface RewardClaim {
  readonly claimHash: string;
  readonly claimKind: RewardClaimKind;
}

export const REWARD_CLAIM_REPOSITORY = Symbol("REWARD_CLAIM_REPOSITORY");

export interface RewardClaimRepositoryPort {
  existsAny(claimHashes: readonly string[]): Promise<boolean>;
  /** 모두 새로 저장됐을 때만 true다. 동시에 같은 해시를 넣으면 나중 요청은 false다. */
  claimAll(claims: readonly RewardClaim[], claimedAt: Date): Promise<boolean>;
}
