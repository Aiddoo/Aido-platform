import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";

import { hasNoBlockWith } from "#api/modules/social/blocks/social-block-queries.public";
import { USER_BRIEF_RELATION } from "#api/modules/social/friends/social-friends.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { cheer as cheerTable } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type {
  CheerReaderPort,
  ListCheersParams,
} from "../../application/ports/cheer.reader.port.js";
import type { CheerRepositoryPort } from "../../application/ports/cheer.repository.port.js";
import type { CheerListItem } from "../../application/read-models/cheer.read-model.js";
import { CheerId } from "../../domain/cheer-id.vo.js";
import type { Cheer } from "../../domain/cheer.aggregate.js";
import { toCheer, toCheerListItem, toCheerRow } from "./cheer-row.mapper.js";

type CheerOwner = "receiverId" | "senderId";

@Injectable()
export class DrizzleCheerRepository implements CheerRepositoryPort, CheerReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<CheerId> {
    return CheerId.reconstitute(await nextSequenceValue(this.#db, cheerTable.id));
  }

  async findById(cheerId: CheerId): Promise<Cheer | null> {
    const row = await this.#db.query.cheer.findFirst({ where: { id: cheerId.value } });
    return row == null ? null : toCheer(row);
  }

  async findLastSent(senderId: UserId, receiverId: UserId): Promise<Cheer | null> {
    const row = await this.#db.query.cheer.findFirst({
      where: { senderId: senderId.value, receiverId: receiverId.value },
      orderBy: { createdAt: "desc" },
    });
    return row == null ? null : toCheer(row);
  }

  countSentBetween(
    senderId: UserId,
    window: Pick<DailySendWindow, "startsAt" | "endsAt">,
  ): Promise<number> {
    return this.#db.$count(
      cheerTable,
      and(
        eq(cheerTable.senderId, senderId.value),
        gte(cheerTable.createdAt, window.startsAt),
        lt(cheerTable.createdAt, window.endsAt),
      ),
    );
  }

  async save(cheer: Cheer): Promise<void> {
    const row = toCheerRow(cheer);
    await this.#db
      .insert(cheerTable)
      .values(row)
      .onConflictDoUpdate({ target: cheerTable.id, set: { readAt: row.readAt } });
  }

  async markManyRead(params: {
    readonly receiverId: UserId;
    readonly cheerIds: readonly CheerId[];
    readonly now: Temporal.Instant;
  }): Promise<number> {
    if (params.cheerIds.length === 0) {
      return 0;
    }
    const updated = await this.#db
      .update(cheerTable)
      .set({ readAt: params.now })
      .where(
        and(
          inArray(
            cheerTable.id,
            params.cheerIds.map((cheerId) => cheerId.value),
          ),
          eq(cheerTable.receiverId, params.receiverId.value),
          isNull(cheerTable.readAt),
        ),
      )
      .returning({ id: cheerTable.id });
    return updated.length;
  }

  listReceived(params: ListCheersParams): Promise<CheerListItem[]> {
    return this.#listOwned(params, "receiverId");
  }

  listSent(params: ListCheersParams): Promise<CheerListItem[]> {
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

  async #listOwned(params: ListCheersParams, owner: CheerOwner): Promise<CheerListItem[]> {
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
    return rows.map(toCheerListItem);
  }
}
