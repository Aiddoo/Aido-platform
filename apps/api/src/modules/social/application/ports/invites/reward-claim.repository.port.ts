import type { RewardClaimSourceKind } from "../../../domain/policies/invites/invite-abuse.policy.js";

export type RewardClaimKind = RewardClaimSourceKind;

/** 같은 기기·같은 신원의 보상 이력. 탈퇴해도 남아 재가입 남용을 막는다. */
export interface RewardClaim {
  readonly claimHash: string;
  readonly claimKind: RewardClaimKind;
}

export const REWARD_CLAIM_REPOSITORY = Symbol("REWARD_CLAIM_REPOSITORY");

export interface RewardClaimRepositoryPort {
  existsAny(claimHashes: readonly string[]): Promise<boolean>;
  /**
   * 모두 새로 저장됐을 때만 true다. 하나라도 이미 있으면 이번에 넣은 것도 지워 아무 claim도 쓰지
   * 않는다(활성 UoW 안에서 호출). 신원이 하나도 없으면 보상 근거가 없으므로 false다.
   */
  claimAll(claims: readonly RewardClaim[], claimedAt: Date): Promise<boolean>;
}
