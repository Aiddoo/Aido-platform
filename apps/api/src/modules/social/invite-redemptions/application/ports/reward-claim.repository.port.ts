import type { RewardClaim } from "../../domain/reward-claim.entity.js";

// 같은 기기·같은 신원의 보상 이력 원장이다. 만든 뒤 바뀌지 않아 집합으로만 읽고 쓴다
export abstract class RewardClaimRepositoryPort {
  abstract existsAnyOf(claims: readonly RewardClaim[]): Promise<boolean>;
  // 모두 새로 저장됐을 때만 true다. 하나라도 이미 있으면 이번에 넣은 것도 지워 아무 claim도 쓰지 않는다
  // (활성 UoW 안에서 호출). 신원이 하나도 없으면 보상 근거가 없으므로 false다
  abstract claimAll(claims: readonly RewardClaim[]): Promise<boolean>;
}
