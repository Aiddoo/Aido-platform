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
    if (claims.length === 0) return true;
    const inserted = await this.client.orm.public.RewardClaim.createAndCount(
      claims.map((claim) =>
        encodeCreate("RewardClaim", {
          claimHash: claim.claimHash,
          claimKind: claim.claimKind,
          firstClaimedAt: claimedAt,
        }),
      ),
      { onConflict: "skip", conflictOn: ["claimHash"] },
    );
    return inserted === claims.length;
  }
}
