import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { cheer as cheerTable } from "#api/platform/database/schema/index";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { DailySendWindow } from "../../../shared/domain/daily-send-window.domain-service.js";
import type { CheerRepositoryPort } from "../../application/ports/cheer.repository.port.js";
import { CheerId } from "../../domain/cheer-id.vo.js";
import type { Cheer } from "../../domain/cheer.aggregate.js";
import { toCheer, toCheerRow } from "./cheer-row.mapper.js";

@Injectable()
export class DrizzleCheerRepository implements CheerRepositoryPort {
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
}
