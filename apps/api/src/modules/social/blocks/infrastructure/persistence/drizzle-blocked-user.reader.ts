import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, isNull, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userBlock } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { USER_BRIEF_RELATION } from "../../../friends/infrastructure/persistence/user-brief-relation.constants.js";
import type { BlockedUserReaderPort } from "../../application/ports/blocked-user.reader.port.js";
import type { BlockedUserReadModel } from "../../application/read-models/blocked-user.read-model.js";
import type { UserBlockId } from "../../domain/user-block-id.vo.js";

@Injectable()
export class DrizzleBlockedUserReader implements BlockedUserReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async listByBlockerId(params: {
    readonly blockerId: UserId;
    readonly afterBlockId: UserBlockId | null;
    readonly limit: number;
  }): Promise<BlockedUserReadModel[]> {
    const { blockerId, afterBlockId, limit } = params;
    const anchor =
      afterBlockId == null
        ? null
        : await this.#db.query.userBlock.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterBlockId.value, blockerId: blockerId.value },
          });
    if (afterBlockId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.userBlock.findMany({
      where: {
        blockerId: blockerId.value,
        blocked: { deletedAt: { isNull: true } },
        ...(anchor != null && {
          RAW: (block) =>
            sql`(${block.createdAt}, ${block.id}) < (${sql.param(anchor.createdAt, block.createdAt)}, ${anchor.id})`,
        }),
      },
      with: { blocked: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit,
    });
    return rows.map((row) => ({
      blockId: row.id,
      userId: row.blocked.id,
      userTag: row.blocked.userTag,
      name: row.blocked.profile?.name ?? null,
      profileImage: row.blocked.profile?.profileImage ?? null,
      blockedAt: row.createdAt,
    }));
  }

  async countByBlockerId(blockerId: UserId): Promise<number> {
    const [result] = await this.#db
      .select({ total: count() })
      .from(userBlock)
      .innerJoin(user, eq(user.id, userBlock.blockedId))
      .where(and(eq(userBlock.blockerId, blockerId.value), isNull(user.deletedAt)));
    return result?.total ?? 0;
  }
}
