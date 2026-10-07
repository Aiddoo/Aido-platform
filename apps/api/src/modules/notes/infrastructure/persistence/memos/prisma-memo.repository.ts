import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import { OrderByItem } from "@prisma/orm-postgres/relational-core/ast";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { databaseTimestamp } from "#api/platform/database/database-values";
import type { Memo as MemoRow } from "#api/platform/database/database.types";
import {
  DatabaseRecordNotFoundError,
  requireRecord,
} from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  FindMemosParams,
  MemoRepositoryPort,
} from "../../../application/ports/memos/memo.repository.port.js";
import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";

@Injectable()
export class PrismaMemoRepository implements MemoRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  private static toDomain(row: MemoRow): Memo {
    return Memo.reconstitute({
      id: row.id,
      userId: row.userId,
      content: row.content,
      isPinned: row.isPinned,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(userId: string, content: string, sortOrder: number): Promise<Memo> {
    const row = decodeRecord(
      "Memo",
      await this.client.orm.public.Memo.create(
        encodeCreate("Memo", { userId, content, sortOrder }),
      ),
    );
    return PrismaMemoRepository.toDomain(row);
  }

  async findByIdAndUserId(memoId: number, userId: string): Promise<Memo | null> {
    const row = decodeRecord(
      "Memo",
      await this.client.orm.public.Memo.where((row) =>
        and(row.id.eq(memoId), row.userId.eq(userId)),
      ).first(),
    );
    return row === null ? null : PrismaMemoRepository.toDomain(row);
  }

  async findManyByUserId(params: FindMemosParams): Promise<Memo[]> {
    const { userId, cursor, size } = params;

    const collection = this.client.orm.public.Memo.where({ userId })
      .orderBy((row) => OrderByItem.desc(row.isPinned.buildAst()))
      .orderBy((row) => row.sortOrder.desc())
      .orderBy((row) => row.id.desc());
    if (cursor === null || cursor === undefined) {
      const rows = decodeRecord("Memo", await collection.limit(size + 1).all());
      return rows.map((row) => PrismaMemoRepository.toDomain(row));
    }
    const anchor = await this.client.orm.public.Memo.where({ id: cursor, userId })
      .select("id", "isPinned", "sortOrder")
      .first();
    if (anchor === null) return [];
    const rows = decodeRecord(
      "Memo",
      await collection
        .cursor(anchor)
        .limit(size + 1)
        .all(),
    );
    return rows.map((row) => PrismaMemoRepository.toDomain(row));
  }

  async countByUserId(userId: string): Promise<number> {
    return this.client.orm.public.Memo.where((row) => row.userId.eq(userId))
      .aggregate((aggregate) => ({ count: aggregate.count() }))
      .then(({ count }) => count);
  }

  updateContent(memoId: number, content: string): Promise<Memo> {
    return this.update(memoId, { content });
  }

  updatePinned(memoId: number, isPinned: boolean): Promise<Memo> {
    return this.update(memoId, { isPinned });
  }

  updateSortOrder(memoId: number, sortOrder: number): Promise<Memo> {
    return this.update(memoId, { sortOrder });
  }

  private async update(
    memoId: number,
    patch: Partial<Pick<MemoRow, "content" | "isPinned" | "sortOrder">>,
  ): Promise<Memo> {
    const [row] = await this.client.orm.public.Memo.where({ id: memoId }).updateAll(
      encodePatch("Memo", patch),
    );
    return PrismaMemoRepository.toDomain(decodeRecord("Memo", requireRecord(row)));
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const { maximum } = await this.client.orm.public.Memo.where({ userId }).aggregate(
      (aggregate) => ({ maximum: aggregate.max("sortOrder") }),
    );
    return maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<void> {
    const plan = this.client.sql.public.Memo.update((fields) => ({
      sortOrder: this.client.raw.sql`${fields.sortOrder} + ${delta}`.returns("pg/int4@1"),
      updatedAt: this.client.raw.sql`${databaseTimestamp(now())}`.returns("pg/timestamp-string@1"),
    }))
      .where((fields, functions) => {
        const conditions = [
          functions.eq(fields.userId, userId),
          functions.gte(fields.sortOrder, fromSortOrder),
        ];
        if (toSortOrder !== null) conditions.push(functions.lte(fields.sortOrder, toSortOrder));
        return functions.and(...conditions);
      })
      .build();
    await this.client.execute(plan);
  }

  async delete(memoId: number): Promise<void> {
    const deleted = await this.client.orm.public.Memo.where({ id: memoId }).deleteAndCount();
    if (deleted === 0) throw new DatabaseRecordNotFoundError();
  }
}
