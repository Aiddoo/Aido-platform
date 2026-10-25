import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/platform/database/database-records";
import { char } from "#api/platform/database/database-values";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  RewardClaim,
  RewardClaimRepositoryPort,
} from "../../../application/ports/invites/reward-claim.repository.port.js";

@Injectable()
export class PrismaRewardClaimRepository implements RewardClaimRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async existsAny(claimHashes: readonly string[]): Promise<boolean> {
    if (claimHashes.length === 0) return false;
    const row = await this.client.orm.public.RewardClaim.where((claim) =>
      claim.claimHash.in(claimHashes.map((claimHash) => char(claimHash, 64))),
    )
      .select("claimHash")
      .first();
    return row != null;
  }

  async claimAll(claims: readonly RewardClaim[], claimedAt: Date): Promise<boolean> {
    if (claims.length === 0) return false;
    const inserted = await this.client.orm.public.RewardClaim.createAll(
      claims.map((claim) =>
        encodeCreate("RewardClaim", {
          claimHash: claim.claimHash,
          claimKind: claim.claimKind,
          firstClaimedAt: claimedAt,
        }),
      ),
      { onConflict: "skip", conflictOn: ["claimHash"] },
    );
    if (inserted.length === claims.length) return true;
    // 일부만 충돌하면 보상 없이 나머지 신원만 소모되므로 이 트랜잭션에서 넣은 행을 되돌린다.
    // 아직 커밋 전이라 다른 트랜잭션은 이 행을 보지 못한다
    if (inserted.length > 0) {
      await this.client.orm.public.RewardClaim.where((claim) =>
        claim.claimHash.in(inserted.map((row) => row.claimHash)),
      ).deleteAndCount();
    }
    return false;
  }
}
