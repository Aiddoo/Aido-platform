import { REWARD_TYPE } from "@aido/api/vocabulary";
import { sumBy, uniq } from "es-toolkit";

import {
  type RewardGrantFailure,
  RewardGrantRepositoryPort,
} from "#api/modules/social/invites/application/ports/reward-grant.repository.port";
import { InviteRedemptionId } from "#api/modules/social/invites/domain/invite-redemption-id.vo";
import type { InviterRewardTotal } from "#api/modules/social/invites/domain/invite-reward.domain-service";
import { INVITE_REWARD_MAX_ATTEMPTS } from "#api/modules/social/invites/domain/invites.constants";
import { RewardGrantId } from "#api/modules/social/invites/domain/reward-grant-id.vo";
import {
  RewardGrant,
  type RewardGrantPrimitives,
} from "#api/modules/social/invites/domain/reward-grant.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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
  readonly #ownRedemptionIds = new Map<string, string>();
  #sequence = 0;

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

  /** 초대받은 사람으로 받은 자기 수락. 초대한 사람 보상 집계에서 뺀다. */
  recordOwnRedemption(userId: string, redemptionId: string): void {
    this.#ownRedemptionIds.set(userId, redemptionId);
  }

  async nextId(): Promise<RewardGrantId> {
    this.#sequence += 1;
    return RewardGrantId.reconstitute(`c${String(this.#sequence).padStart(24, "0")}`);
  }

  async addAll(grants: readonly RewardGrant[]): Promise<number> {
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

  async summarizeInviterRewards(
    inviterId: UserId,
    windowStart: Temporal.Instant,
  ): Promise<InviterRewardTotal[]> {
    const ownRedemptionId = this.#ownRedemptionIds.get(inviterId.value);
    const inviterGrants = [...this.#grants.values()].filter(
      (grant) =>
        grant.recipientId === inviterId.value &&
        grant.sourceType === "INVITE_REDEMPTION" &&
        grant.sourceId !== ownRedemptionId &&
        (grant.status !== "FAILED" || grant.attempts < INVITE_REWARD_MAX_ATTEMPTS),
    );
    return Object.values(REWARD_TYPE).flatMap((rewardType) => {
      const rows = inviterGrants.filter((grant) => grant.rewardType === rewardType);
      if (rows.length === 0) {
        return [];
      }
      return [
        {
          rewardType,
          quantityInWindow: sumBy(
            rows.filter((grant) => Temporal.Instant.compare(grant.createdAt, windowStart) > 0),
            (grant) => grant.quantity,
          ),
          totalQuantity: sumBy(rows, (grant) => grant.quantity),
          appliedQuantity: sumBy(
            rows.filter((grant) => grant.status === "APPLIED"),
            (grant) => grant.quantity,
          ),
        },
      ];
    });
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
