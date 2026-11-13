import { uniq } from "es-toolkit";

import {
  type RewardGrantFailure,
  RewardGrantRepositoryPort,
} from "#api/modules/social/invite-redemptions/application/ports/reward-grant.repository.port";
import { InviteRedemptionId } from "#api/modules/social/invite-redemptions/domain/invite-redemption-id.vo";
import type { RewardGrantId } from "#api/modules/social/invite-redemptions/domain/reward-grant-id.vo";
import {
  RewardGrant,
  type RewardGrantPrimitives,
} from "#api/modules/social/invite-redemptions/domain/reward-grant.entity";

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function isSameLedgerKey(left: RewardGrantPrimitives, right: RewardGrantPrimitives): boolean {
  return (
    left.sourceType === right.sourceType &&
    left.sourceId === right.sourceId &&
    left.recipientId === right.recipientId &&
    left.rewardType === right.rewardType
  );
}

// Drizzle 저장소처럼 적용·실패 표시는 조건이 맞을 때만 바꾸고, 원장 키가 겹치면 저장하지 않는다
export class InMemoryRewardGrantRepository extends RewardGrantRepositoryPort {
  readonly #grants = new Map<string, RewardGrantPrimitives>();

  constructor(grants: readonly RewardGrant[] = []) {
    super();
    for (const grant of grants) {
      this.#grants.set(grant.id.value, grant.toPrimitives());
    }
  }

  get size(): number {
    return this.#grants.size;
  }

  /** 트랜잭션 rollback을 흉내 내려고 지금 원장을 떠 둔다. */
  captureState(): ReadonlyMap<string, RewardGrantPrimitives> {
    return new Map(this.#grants);
  }

  restoreState(state: ReadonlyMap<string, RewardGrantPrimitives>): void {
    this.#grants.clear();
    for (const [id, grant] of state) {
      this.#grants.set(id, grant);
    }
  }

  // InMemory 조회 대역이 같은 원장을 읽도록 연다
  listAll(): RewardGrantPrimitives[] {
    return [...this.#grants.values()];
  }

  async addPending(grants: readonly RewardGrant[]): Promise<number> {
    let insertedCount = 0;
    for (const grant of grants) {
      const primitives = grant.toPrimitives();
      if ([...this.#grants.values()].some((existing) => isSameLedgerKey(existing, primitives))) {
        continue;
      }
      this.#grants.set(primitives.id, primitives);
      insertedCount += 1;
    }
    return insertedCount;
  }

  async listByRedemptionId(redemptionId: InviteRedemptionId): Promise<RewardGrant[]> {
    return [...this.#grants.values()]
      .filter(
        (grant) =>
          grant.sourceType === "INVITE_REDEMPTION" && grant.sourceId === redemptionId.value,
      )
      .toSorted((left, right) => compareText(left.id, right.id))
      .map((grant) => RewardGrant.reconstitute(grant));
  }

  async markApplied(grantId: RewardGrantId, _appliedAt: Temporal.Instant): Promise<boolean> {
    const grant = this.#grants.get(grantId.value);
    if (grant == null || grant.status === "APPLIED") {
      return false;
    }
    this.#grants.set(grant.id, { ...grant, status: "APPLIED" });
    return true;
  }

  async markFailed(grantId: RewardGrantId, failure: RewardGrantFailure): Promise<number | null> {
    const grant = this.#grants.get(grantId.value);
    if (grant == null || grant.status === "APPLIED") {
      return null;
    }
    const attempts = grant.attempts + (failure.countsAttempt ? 1 : 0);
    this.#grants.set(grant.id, { ...grant, status: "FAILED", attempts });
    return attempts;
  }

  async listRetryableRedemptionIds(params: {
    readonly maxAttempts: number;
    readonly createdBefore: Temporal.Instant;
    readonly afterRedemptionId: InviteRedemptionId | null;
    readonly limit: number;
  }): Promise<InviteRedemptionId[]> {
    const afterId = params.afterRedemptionId?.value ?? null;
    const sourceIds = [...this.#grants.values()]
      .filter(
        (grant) =>
          grant.sourceType === "INVITE_REDEMPTION" &&
          grant.status !== "APPLIED" &&
          grant.attempts < params.maxAttempts &&
          Temporal.Instant.compare(grant.createdAt, params.createdBefore) <= 0 &&
          (afterId == null || compareText(grant.sourceId, afterId) > 0),
      )
      .map((grant) => grant.sourceId);
    return uniq(sourceIds)
      .toSorted(compareText)
      .slice(0, params.limit)
      .map((sourceId) => InviteRedemptionId.reconstitute(sourceId));
  }
}
