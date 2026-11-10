import type { RewardClaim } from "../../domain/reward-claim.vo.js";

export abstract class RewardClaimRepositoryPort {
  abstract existsAny(claims: readonly RewardClaim[]): Promise<boolean>;
  /**
   * 모두 새로 저장됐을 때만 true다. 하나라도 이미 있으면 이번에 넣은 것도 지워 아무 claim도 쓰지
   * 않는다(활성 UoW 안에서 호출). 신원이 하나도 없으면 보상 근거가 없으므로 false다.
   */
  abstract claimAll(claims: readonly RewardClaim[], claimedAt: Temporal.Instant): Promise<boolean>;
}
