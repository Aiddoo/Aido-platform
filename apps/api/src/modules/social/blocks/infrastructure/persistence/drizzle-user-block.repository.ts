import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, notExists, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { follow, userBlock } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";

import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "../../application/ports/user-block.reader.port.js";
import type { UserBlockRepositoryPort } from "../../application/ports/user-block.repository.port.js";
import { UserBlockId } from "../../domain/user-block-id.vo.js";
import type { UserBlock } from "../../domain/user-block.aggregate.js";
import { toUserBlock, toUserBlockRow } from "./user-block-row.mapper.js";

// 콕·응원 기록처럼 상대가 정해진 행을 고를 때 붙여 차단 관계를 행마다 따로 읽지 않고 한 SQL의 NOT EXISTS로 거른다
export function hasNoBlockWith(userId: AnyColumn, viewerId: string): SQL {
  return notExists(
    new QueryBuilder()
      .select({ one: sql`1` })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, viewerId)),
          and(eq(userBlock.blockerId, viewerId), eq(userBlock.blockedId, userId)),
        ),
      ),
  );
}

@Injectable()
export class DrizzleUserBlockRepository implements UserBlockRepositoryPort, UserBlockReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<UserBlockId> {
    return UserBlockId.reconstitute(createEntityId());
  }

  async existsActiveUser(userId: UserId): Promise<boolean> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId.value, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findByPair(blockerId: UserId, blockedId: UserId): Promise<UserBlock | null> {
    const row = await this.#db.query.userBlock.findFirst({
      where: { blockerId: blockerId.value, blockedId: blockedId.value },
    });
    return row == null ? null : toUserBlock(row);
  }

  async removeFriendshipsBetween(userId: UserId, otherUserId: UserId): Promise<number> {
    const deleted = await this.#db
      .delete(follow)
      .where(
        or(
          and(eq(follow.followerId, userId.value), eq(follow.followingId, otherUserId.value)),
          and(eq(follow.followerId, otherUserId.value), eq(follow.followingId, userId.value)),
        ),
      )
      .returning({ id: follow.id });
    return deleted.length;
  }

  async save(block: UserBlock): Promise<void> {
    // 차단은 만든 뒤 바뀌지 않아 같은 id를 다시 저장하면 그대로 둔다
    await this.#db
      .insert(userBlock)
      .values(toUserBlockRow(block))
      .onConflictDoNothing({ target: userBlock.id });
  }

  async delete(block: UserBlock): Promise<void> {
    await this.#db.delete(userBlock).where(eq(userBlock.id, block.id.value));
  }

  async findRelation(userId: UserId, otherUserId: UserId): Promise<UserBlockRelation> {
    const rows = await this.#db
      .select({ blockerId: userBlock.blockerId })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, userId.value), eq(userBlock.blockedId, otherUserId.value)),
          and(eq(userBlock.blockerId, otherUserId.value), eq(userBlock.blockedId, userId.value)),
        ),
      );
    return {
      isBlocking: rows.some((row) => row.blockerId === userId.value),
      isBlockedBy: rows.some((row) => row.blockerId === otherUserId.value),
    };
  }

  async findBlockedCounterpartIds(
    viewerId: UserId,
    candidateUserIds: readonly UserId[],
  ): Promise<ReadonlySet<string>> {
    const candidates = candidateUserIds
      .map((userId) => userId.value)
      .filter((userId) => userId !== viewerId.value);
    if (candidates.length === 0) {
      return new Set();
    }
    const rows = await this.#db
      .select({ blockerId: userBlock.blockerId, blockedId: userBlock.blockedId })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, viewerId.value), inArray(userBlock.blockedId, candidates)),
          and(eq(userBlock.blockedId, viewerId.value), inArray(userBlock.blockerId, candidates)),
        ),
      );
    return new Set(
      rows.map((row) => (row.blockerId === viewerId.value ? row.blockedId : row.blockerId)),
    );
  }
}
