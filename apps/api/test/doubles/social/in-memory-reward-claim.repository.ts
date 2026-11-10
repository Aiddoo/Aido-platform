import { RewardClaimRepositoryPort } from "#api/modules/social/invites/application/ports/reward-claim.repository.port";
import type { RewardClaim } from "#api/modules/social/invites/domain/reward-claim.vo";

// Drizzle 저장소처럼 하나라도 이미 있으면 이번 claim을 하나도 남기지 않는다
export class InMemoryRewardClaimRepository extends RewardClaimRepositoryPort {
  readonly #claimHashes = new Set<string>();

  constructor(claims: readonly RewardClaim[] = []) {
    super();
    for (const claim of claims) {
      this.#claimHashes.add(claim.claimHash);
    }
  }

  get size(): number {
    return this.#claimHashes.size;
  }

  async existsAny(claims: readonly RewardClaim[]): Promise<boolean> {
    return claims.some((claim) => this.#claimHashes.has(claim.claimHash));
  }

  async claimAll(claims: readonly RewardClaim[], _claimedAt: Temporal.Instant): Promise<boolean> {
    const claimHashes = new Set(claims.map((claim) => claim.claimHash));
    // 같은 해시를 두 번 넣으면 Drizzle 저장소도 한 행만 들어가 전부 새로 저장된 것이 아니다
    if (
      claims.length === 0 ||
      claimHashes.size !== claims.length ||
      (await this.existsAny(claims))
    ) {
      return false;
    }
    for (const claim of claims) {
      this.#claimHashes.add(claim.claimHash);
    }
    return true;
  }
}
