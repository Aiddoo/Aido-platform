import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, notExists, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userBlock } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "../../application/ports/user-block.reader.port.js";

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
export class DrizzleUserBlockReader implements UserBlockReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
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
