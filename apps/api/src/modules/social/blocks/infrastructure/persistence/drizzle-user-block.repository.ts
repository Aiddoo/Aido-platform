import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import {
  and,
  eq,
  notExists,
  or,
  sql,
  type AnyColumn,
  type SQL,
  count,
  inArray,
  isNull,
} from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userBlock, follow, user } from "#api/platform/database/schema/index";

import { USER_BRIEF_RELATION } from "../../../friends/infrastructure/persistence/user-brief-relation.constants.js";
import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "../../application/ports/user-block.reader.port.js";
import type {
  BlockedUserRecord,
  FindBlockedUsersParams,
  UserBlockRepositoryPort,
} from "../../application/ports/user-block.repository.port.js";
import { UserBlock, type UserBlockCreationPlan } from "../../domain/user-block.aggregate.js";

/**
 * 사용자와 viewer 사이에 어느 방향으로든 차단이 없을 때만 참이다.
 *
 * 콕·응원 기록처럼 상대 사용자가 정해진 행을 고를 때 붙여 한 SQL 안의
 * NOT EXISTS로 처리한다. 차단 관계를 행마다 따로 조회하지 않는다.
 */
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

type UserBlockRow = typeof userBlock.$inferSelect;

@Injectable()
export class DrizzleUserBlockRepository implements UserBlockRepositoryPort, UserBlockReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async userExists(userId: string): Promise<boolean> {
    const found = await this.#db.query.user.findFirst({
      columns: { id: true },
      where: { id: userId, status: "ACTIVE", deletedAt: { isNull: true } },
    });
    return found != null;
  }

  async findByPair(blockerId: string, blockedId: string): Promise<UserBlock | null> {
    const row = await this.#db.query.userBlock.findFirst({ where: { blockerId, blockedId } });
    return row == null ? null : toUserBlock(row);
  }

  async create(plan: UserBlockCreationPlan): Promise<UserBlock> {
    const [row] = await this.#db
      .insert(userBlock)
      .values({
        blockerId: plan.blockerId,
        blockedId: plan.blockedId,
        createdAt: plan.createdAt,
      })
      .returning();
    return toUserBlock(requireRecord(row));
  }

  async delete(blockerId: string, blockedId: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(userBlock)
      .where(and(eq(userBlock.blockerId, blockerId), eq(userBlock.blockedId, blockedId)))
      .returning({ id: userBlock.id });
    return deleted.length > 0;
  }

  async removeFriendshipsBetween(userId: string, otherUserId: string): Promise<number> {
    const deleted = await this.#db
      .delete(follow)
      .where(
        or(
          and(eq(follow.followerId, userId), eq(follow.followingId, otherUserId)),
          and(eq(follow.followerId, otherUserId), eq(follow.followingId, userId)),
        ),
      )
      .returning({ id: follow.id });
    return deleted.length;
  }

  async findBlockedUsers(params: FindBlockedUsersParams): Promise<BlockedUserRecord[]> {
    const anchor =
      params.cursor == null
        ? undefined
        : await this.#db.query.userBlock.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: params.cursor, blockerId: params.blockerId },
          });
    if (params.cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.#db.query.userBlock.findMany({
      where: {
        blockerId: params.blockerId,
        blocked: { deletedAt: { isNull: true } },
        ...(anchor != null && {
          RAW: (block) =>
            sql`(${block.createdAt}, ${block.id}) < (${sql.param(anchor.createdAt, block.createdAt)}, ${anchor.id})`,
        }),
      },
      with: { blocked: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: params.size + 1,
    });
    return rows.map((row) => ({
      id: row.id,
      blockedAt: row.createdAt,
      user: { id: row.blocked.id, userTag: row.blocked.userTag, profile: row.blocked.profile },
    }));
  }

  async countBlockedUsers(blockerId: string): Promise<number> {
    const [result] = await this.#db
      .select({ total: count() })
      .from(userBlock)
      .innerJoin(user, eq(user.id, userBlock.blockedId))
      .where(and(eq(userBlock.blockerId, blockerId), isNull(user.deletedAt)));
    return result?.total ?? 0;
  }

  async findRelation(userId: string, otherUserId: string): Promise<UserBlockRelation> {
    const rows = await this.#db
      .select({ blockerId: userBlock.blockerId })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, userId), eq(userBlock.blockedId, otherUserId)),
          and(eq(userBlock.blockerId, otherUserId), eq(userBlock.blockedId, userId)),
        ),
      );
    return {
      isBlocking: rows.some((row) => row.blockerId === userId),
      isBlockedBy: rows.some((row) => row.blockerId === otherUserId),
    };
  }

  async findBlockedCounterpartIds(
    viewerId: string,
    candidateUserIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const candidates = candidateUserIds.filter((userId) => userId !== viewerId);
    if (candidates.length === 0) {
      return new Set();
    }
    const rows = await this.#db
      .select({ blockerId: userBlock.blockerId, blockedId: userBlock.blockedId })
      .from(userBlock)
      .where(
        or(
          and(eq(userBlock.blockerId, viewerId), inArray(userBlock.blockedId, candidates)),
          and(eq(userBlock.blockedId, viewerId), inArray(userBlock.blockerId, candidates)),
        ),
      );
    return new Set(rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)));
  }
}

function toUserBlock(row: UserBlockRow): UserBlock {
  return UserBlock.reconstitute({
    id: row.id,
    blockerId: row.blockerId,
    blockedId: row.blockedId,
    createdAt: row.createdAt,
  });
}
