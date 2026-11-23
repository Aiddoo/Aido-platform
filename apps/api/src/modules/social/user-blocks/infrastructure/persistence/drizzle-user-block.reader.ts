import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, or } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userBlock } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  UserBlockReaderPort,
  UserBlockRelation,
} from "../../application/ports/user-block.reader.port.js";

@Injectable()
export class DrizzleUserBlockReader implements UserBlockReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async getRelation(userId: UserId, otherUserId: UserId): Promise<UserBlockRelation> {
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

  async listBlockedCounterpartIds(
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

  get #db() {
    return this.#transactionHost.tx;
  }
}
