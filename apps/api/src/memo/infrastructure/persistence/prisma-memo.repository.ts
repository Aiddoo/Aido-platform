import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import { OrderByItem } from "@prisma/orm-postgres/relational-core/ast";

import { now } from "#api/shared/domain/date/utils/core";
import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { databaseTimestamp } from "#api/shared/infrastructure/database/database-values";
import type { Memo as MemoRow } from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type {
  FindMemosParams,
  MemoRepositoryPort,
} from "../../application/ports/memo.repository.port.js";
import { Memo } from "../../domain/entities/memo.aggregate.js";

/**
 * MemoRepositoryPort의 Prisma 어댑터.
 *
 * Prisma Memo 행을 도메인 애그리게잇으로 매핑한다. 트랜잭션은 CLS로 전파된다 —
 * TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환한다.
 */
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
        encodeCreate("Memo", { userId: userId, content, sortOrder }),
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
    return row ? PrismaMemoRepository.toDomain(row) : null;
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
    const anchor = await this.client.orm.public.Memo.where({ id: cursor })
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

  async updateContent(memoId: number, content: string): Promise<Memo> {
    const row = decodeRecord(
      "Memo",
      requireRecord(
        await this.client.orm.public.Memo.where((row) => row.id.eq(memoId)).update(
          encodePatch("Memo", { content }),
        ),
      ),
    );
    return PrismaMemoRepository.toDomain(row);
  }

  async updatePinned(memoId: number, isPinned: boolean): Promise<Memo> {
    const row = decodeRecord(
      "Memo",
      requireRecord(
        await this.client.orm.public.Memo.where((row) => row.id.eq(memoId)).update(
          encodePatch("Memo", { isPinned }),
        ),
      ),
    );
    return PrismaMemoRepository.toDomain(row);
  }

  async updateSortOrder(memoId: number, sortOrder: number): Promise<Memo> {
    const row = decodeRecord(
      "Memo",
      requireRecord(
        await this.client.orm.public.Memo.where((row) => row.id.eq(memoId)).update(
          encodePatch("Memo", { sortOrder }),
        ),
      ),
    );
    return PrismaMemoRepository.toDomain(row);
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
      .where((fields, functions) =>
        functions.and(
          functions.eq(fields.userId, userId),
          functions.gte(fields.sortOrder, fromSortOrder),
          toSortOrder === null
            ? this.client.raw.sql`TRUE`.returns("pg/bool@1")
            : functions.lte(fields.sortOrder, toSortOrder),
        ),
      )
      .build();
    await this.client.execute(plan);
  }

  async delete(memoId: number): Promise<void> {
    decodeRecord(
      "Memo",
      requireRecord(await this.client.orm.public.Memo.where((row) => row.id.eq(memoId)).delete()),
    );
  }
}
