import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { keyBy, uniq } from "es-toolkit";

import {
  UserBriefReaderPort,
  type UserBriefReadModel,
} from "#api/modules/identity/users/identity-users.public";
import { hasNoBlockWith } from "#api/modules/social/user-blocks/social-user-blocks.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { cheer as cheerTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  CheerReaderPort,
  ListCheersParams,
} from "../../application/ports/cheer.reader.port.js";
import type {
  CheerReadModel,
  CheerUserReadModel,
} from "../../application/read-models/cheer.read-model.js";

type CheerOwner = "receiverId" | "senderId";

type CheerRow = typeof cheerTable.$inferSelect;

function toCheerUserReadModel(brief: UserBriefReadModel): CheerUserReadModel {
  return {
    id: brief.userId.value,
    userTag: brief.userTag,
    name: brief.name,
    profileImage: brief.profileImage,
  };
}

// 응원 행은 이 Context에서 읽고, 보낸·받은 사람 프로필은 identity 조회 포트로 한 번에 붙인다
@Injectable()
export class DrizzleCheerReader implements CheerReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
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
      orderBy: { createdAt: "desc", id: "desc" },
      limit,
    });
    return this.#toCheerReadModels(rows);
  }

  async #toCheerReadModels(rows: readonly CheerRow[]): Promise<CheerReadModel[]> {
    const briefs = await this.#userBriefReader.findByUserIds(
      uniq(rows.flatMap((row) => [row.senderId, row.receiverId])).map((userId) =>
        UserId.reconstitute(userId),
      ),
    );
    const users = keyBy(briefs, (brief) => brief.userId.value);
    // 사람이 FK로 지워지면 응원도 함께 지워진다. 그 사이에 사라진 행은 목록에서 뺀다
    return rows.flatMap((row) => {
      const sender = users[row.senderId];
      const receiver = users[row.receiverId];
      if (sender == null || receiver == null) {
        return [];
      }
      return [
        {
          id: row.id,
          senderId: row.senderId,
          receiverId: row.receiverId,
          message: row.message,
          readAt: row.readAt,
          createdAt: row.createdAt,
          sender: toCheerUserReadModel(sender),
          receiver: toCheerUserReadModel(receiver),
        },
      ];
    });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
