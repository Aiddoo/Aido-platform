import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { keyBy } from "es-toolkit";

import {
  undeletedUserCondition,
  UserBriefReaderPort,
} from "#api/modules/identity/users/identity-users.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { userBlock } from "#api/platform/database/schema/index";
import {
  type CursorPage,
  emptyCursorPage,
  toMappedCursorPage,
} from "#api/shared/application/cursor-page";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BlockedUserReaderPort } from "../../application/ports/blocked-user.reader.port.js";
import type { BlockedUserReadModel } from "../../application/read-models/blocked-user.read-model.js";
import type { UserBlockId } from "../../domain/user-block-id.vo.js";

@Injectable()
export class DrizzleBlockedUserReader implements BlockedUserReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #userBriefReader: UserBriefReaderPort;

  constructor(
    transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
    userBriefReader: UserBriefReaderPort,
  ) {
    this.#transactionHost = transactionHost;
    this.#userBriefReader = userBriefReader;
  }

  async listByBlockerId(params: {
    readonly blockerId: UserId;
    readonly afterBlockId: UserBlockId | null;
    readonly size: number;
  }): Promise<CursorPage<BlockedUserReadModel, string>> {
    const { blockerId, afterBlockId, size } = params;
    const anchor =
      afterBlockId == null
        ? null
        : await this.#db.query.userBlock.findFirst({
            columns: { id: true, createdAt: true },
            where: { id: afterBlockId.value, blockerId: blockerId.value },
          });
    if (afterBlockId != null && anchor == null) {
      return emptyCursorPage(size);
    }

    const rows = await this.#db.query.userBlock.findMany({
      where: {
        blockerId: blockerId.value,
        AND: [
          { RAW: (block) => undeletedUserCondition(block.blockedId) },
          ...(anchor == null
            ? []
            : [
                {
                  RAW: (block: typeof userBlock) =>
                    tupleLessThan([block.createdAt, block.id], [anchor.createdAt, anchor.id]),
                },
              ]),
        ],
      },
      orderBy: { createdAt: "desc", id: "desc" },
      limit: size + 1,
    });
    return toMappedCursorPage({
      rows,
      size,
      toCursor: (row) => row.id,
      toItems: (pageRows) => this.#toBlockedUsers(pageRows),
    });
  }

  countByBlockerId(blockerId: UserId): Promise<number> {
    return this.#db.$count(
      userBlock,
      and(eq(userBlock.blockerId, blockerId.value), undeletedUserCondition(userBlock.blockedId)),
    );
  }

  async #toBlockedUsers(
    rows: readonly (typeof userBlock.$inferSelect)[],
  ): Promise<BlockedUserReadModel[]> {
    const briefs = keyBy(
      await this.#userBriefReader.listByUserIds(
        rows.map((row) => UserId.reconstitute(row.blockedId)),
      ),
      (brief) => brief.userId.value,
    );
    return rows.flatMap((row) => {
      const brief = briefs[row.blockedId];
      if (brief == null) {
        return [];
      }
      return [
        {
          blockId: row.id,
          userId: row.blockedId,
          userTag: brief.userTag,
          name: brief.name,
          profileImage: brief.profileImage,
          blockedAt: row.createdAt,
        },
      ];
    });
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
