import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, max, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { memo } from "#api/platform/database/schema/index";

import type {
  FindMemosParams,
  MemoRepositoryPort,
} from "../../application/ports/memo.repository.port.js";
import { Memo } from "../../domain/memo.aggregate.js";

type MemoRow = typeof memo.$inferSelect;
type MemoPatch = Partial<Pick<MemoRow, "content" | "isPinned" | "sortOrder">>;

function toDomain(row: MemoRow): Memo {
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

@Injectable()
export class DrizzleMemoRepository implements MemoRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async create(userId: string, content: string, sortOrder: number): Promise<Memo> {
    const [row] = await this.#db.insert(memo).values({ userId, content, sortOrder }).returning();
    return toDomain(requireRecord(row));
  }

  async findByIdAndUserId(memoId: number, userId: string): Promise<Memo | null> {
    const row = await this.#db.query.memo.findFirst({ where: { id: memoId, userId } });
    return row == null ? null : toDomain(row);
  }

  async findManyByUserId({ userId, cursor, size }: FindMemosParams): Promise<Memo[]> {
    const anchor =
      cursor == null
        ? undefined
        : await this.#db.query.memo.findFirst({
            columns: { id: true, isPinned: true, sortOrder: true },
            where: { id: cursor, userId },
          });
    if (cursor != null && anchor == null) {
      return [];
    }

    const rows = await this.#db
      .select()
      .from(memo)
      .where(
        and(
          eq(memo.userId, userId),
          anchor &&
            sql`(${memo.isPinned}, ${memo.sortOrder}, ${memo.id}) < (${anchor.isPinned}, ${anchor.sortOrder}, ${anchor.id})`,
        ),
      )
      .orderBy(desc(memo.isPinned), desc(memo.sortOrder), desc(memo.id))
      .limit(size + 1);
    return rows.map((row) => toDomain(row));
  }

  countByUserId(userId: string): Promise<number> {
    return this.#db.$count(memo, eq(memo.userId, userId));
  }

  updateContent(memoId: number, content: string): Promise<Memo> {
    return this.#update(memoId, { content });
  }

  updatePinned(memoId: number, isPinned: boolean): Promise<Memo> {
    return this.#update(memoId, { isPinned });
  }

  updateSortOrder(memoId: number, sortOrder: number): Promise<Memo> {
    return this.#update(memoId, { sortOrder });
  }

  async #update(memoId: number, patch: MemoPatch): Promise<Memo> {
    const [row] = await this.#db.update(memo).set(patch).where(eq(memo.id, memoId)).returning();
    return toDomain(requireRecord(row));
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    const [result] = await this.#db
      .select({ maximum: max(memo.sortOrder) })
      .from(memo)
      .where(eq(memo.userId, userId));
    return result?.maximum ?? -1;
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<void> {
    await this.#db
      .update(memo)
      .set({ sortOrder: sql`${memo.sortOrder} + ${delta}` })
      .where(
        and(
          eq(memo.userId, userId),
          gte(memo.sortOrder, fromSortOrder),
          toSortOrder == null ? undefined : lte(memo.sortOrder, toSortOrder),
        ),
      );
  }

  async delete(memoId: number): Promise<void> {
    const deleted = await this.#db
      .delete(memo)
      .where(eq(memo.id, memoId))
      .returning({ id: memo.id });
    requireRecord(deleted[0]);
  }
}
