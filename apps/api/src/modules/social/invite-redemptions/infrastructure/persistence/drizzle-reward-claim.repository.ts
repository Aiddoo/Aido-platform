import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { inArray } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { rewardClaim } from "#api/platform/database/schema/index";

import { RewardClaimRepositoryPort } from "../../application/ports/reward-claim.repository.port.js";
import type { RewardClaim } from "../../domain/reward-claim.entity.js";
import { toRewardClaimRow } from "./reward-claim-row.mapper.js";

@Injectable()
export class DrizzleRewardClaimRepository implements RewardClaimRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async existsAnyOf(claims: readonly RewardClaim[]): Promise<boolean> {
    if (claims.length === 0) {
      return false;
    }
    const row = await this.#db.query.rewardClaim.findFirst({
      columns: { claimHash: true },
      where: { claimHash: { in: claims.map((claim) => claim.claimHash) } },
    });
    return row != null;
  }

  async claimAll(claims: readonly RewardClaim[]): Promise<boolean> {
    if (claims.length === 0) {
      return false;
    }
    const inserted = await this.#db
      .insert(rewardClaim)
      .values(claims.map(toRewardClaimRow))
      .onConflictDoNothing({ target: rewardClaim.claimHash })
      .returning({ claimHash: rewardClaim.claimHash });
    if (inserted.length === claims.length) {
      return true;
    }
    // 일부만 충돌하면 보상 없이 나머지 신원만 소모되므로 이 트랜잭션에서 넣은 행을 되돌린다.
    // 아직 커밋 전이라 다른 트랜잭션은 이 행을 보지 못한다
    if (inserted.length > 0) {
      await this.#db.delete(rewardClaim).where(
        inArray(
          rewardClaim.claimHash,
          inserted.map((row) => row.claimHash),
        ),
      );
    }
    return false;
  }
}
