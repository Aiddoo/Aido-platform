import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";

import { hasNoBlockWith } from "#api/modules/social/blocks/social-block-queries.public";
import {
  USER_BRIEF_RELATION,
  type UserBriefRow,
} from "#api/modules/social/friends/social-friends.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { cheer as cheerTable } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  CheerReaderPort,
  ListCheersParams,
} from "../../application/ports/cheer.reader.port.js";
import type {
  CheerReadModel,
  CheerUserReadModel,
} from "../../application/read-models/cheer.read-model.js";

type CheerOwner = "receiverId" | "senderId";

type CheerRowWithUsers = typeof cheerTable.$inferSelect & {
  readonly sender: UserBriefRow;
  readonly receiver: UserBriefRow;
};

function toCheerUserReadModel(row: UserBriefRow): CheerUserReadModel {
  return {
    id: row.id,
    userTag: row.userTag,
    name: row.profile?.name ?? null,
    profileImage: row.profile?.profileImage ?? null,
  };
}

function toCheerReadModel(row: CheerRowWithUsers): CheerReadModel {
  return {
    id: row.id,
    senderId: row.senderId,
    receiverId: row.receiverId,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
    sender: toCheerUserReadModel(row.sender),
    receiver: toCheerUserReadModel(row.receiver),
  };
}

@Injectable()
export class DrizzleCheerReader implements CheerReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  listReceived(params: ListCheersParams): Promise<CheerReadModel[]> {
    return this.#listOwned(params, "receiverId");
  }

  listSent(params: ListCheersParams): Promise<CheerReadModel[]> {
    return this.#listOwned(params, "senderId");
  }

  countReceived(userId: UserId): Promise<number> {
    return this.#db.$count(
      cheerTable,
      and(
        eq(cheerTable.receiverId, userId.value),
        hasNoBlockWith(cheerTable.senderId, userId.value),
      ),
    );
  }

  countSent(userId: UserId): Promise<number> {
    return this.#db.$count(
      cheerTable,
      and(
        eq(cheerTable.senderId, userId.value),
        hasNoBlockWith(cheerTable.receiverId, userId.value),
      ),
    );
  }

  countUnreadReceived(userId: UserId): Promise<number> {
    return this.#db.$count(
      cheerTable,
      and(
        eq(cheerTable.receiverId, userId.value),
        isNull(cheerTable.readAt),
        hasNoBlockWith(cheerTable.senderId, userId.value),
      ),
    );
  }

  async #listOwned(params: ListCheersParams, owner: CheerOwner): Promise<CheerReadModel[]> {
    const { userId, afterCheerId, limit } = params;
    // 커서는 응원 id 하나라 그 응원의 생성 시각을 먼저 읽어 (createdAt, id) 경계를 만든다
    const anchor =
      afterCheerId == null
        ? null
        : await this.#db.query.cheer.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterCheerId.value },
          });
    if (afterCheerId != null && anchor == null) {
      return [];
    }
    const rows = await this.#db.query.cheer.findMany({
      where: {
        ...(owner === "receiverId" ? { receiverId: userId.value } : { senderId: userId.value }),
        AND: [
          {
            RAW: (table) =>
              hasNoBlockWith(
                owner === "receiverId" ? table.senderId : table.receiverId,
                userId.value,
              ),
          },
          ...(anchor == null
            ? []
            : [
                {
                  RAW: (table: typeof cheerTable) =>
                    tupleLessThan([table.createdAt, table.id], [anchor.createdAt, anchor.id]),
                },
              ]),
        ],
      },
      with: { sender: USER_BRIEF_RELATION, receiver: USER_BRIEF_RELATION },
      orderBy: { createdAt: "desc", id: "desc" },
      limit,
    });
    return rows.map(toCheerReadModel);
  }
}
