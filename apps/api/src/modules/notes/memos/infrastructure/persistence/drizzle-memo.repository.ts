import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, lte, max, sql } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { tupleLessThan } from "#api/platform/database/keyset";
import { memo as memoTable } from "#api/platform/database/schema/notes.schema";
import { nextSequenceValue } from "#api/platform/database/sequence";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { MemoRepositoryPort } from "../../application/ports/memo.repository.port.js";
import { MemoId } from "../../domain/memo-id.vo.js";
import type { SortOrderShift } from "../../domain/memo-ordering.domain-service.js";
import type { Memo } from "../../domain/memo.aggregate.js";
import { toMemo, toMemoRow } from "./memo-row.mapper.js";

@Injectable()
export class DrizzleMemoRepository implements MemoRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async nextId(): Promise<MemoId> {
    return MemoId.reconstitute(await nextSequenceValue(this.#db, memoTable.id));
  }

  async findByIdAndUserId(memoId: MemoId, userId: UserId): Promise<Memo | null> {
    const row = await this.#db.query.memo.findFirst({
      where: { id: memoId.value, userId: userId.value },
    });
    return row == null ? null : toMemo(row);
  }

  async listByUserId(params: {
    readonly userId: UserId;
    readonly afterMemoId: MemoId | null;
    readonly limit: number;
  }): Promise<Memo[]> {
    const { userId, afterMemoId, limit } = params;
    const anchor =
      afterMemoId == null
        ? null
        : await this.#db.query.memo.findFirst({
            columns: { id: true, isPinned: true, sortOrder: true },
            where: { id: afterMemoId.value, userId: userId.value },
          });
    if (afterMemoId != null && anchor == null) {
      return [];
    }

    const rows = await this.#db
      .select()
      .from(memoTable)
      .where(
        and(
          eq(memoTable.userId, userId.value),
          anchor == null
            ? undefined
            : tupleLessThan(
                [memoTable.isPinned, memoTable.sortOrder, memoTable.id],
                [anchor.isPinned, anchor.sortOrder, anchor.id],
              ),
        ),
      )
      .orderBy(desc(memoTable.isPinned), desc(memoTable.sortOrder), desc(memoTable.id))
      .limit(limit);
    return rows.map(toMemo);
  }

  countByUserId(userId: UserId): Promise<number> {
    return this.#db.$count(memoTable, eq(memoTable.userId, userId.value));
  }

  async findMaxSortOrder(userId: UserId): Promise<number | null> {
    const [result] = await this.#db
      .select({ maxSortOrder: max(memoTable.sortOrder) })
      .from(memoTable)
      .where(eq(memoTable.userId, userId.value));
    return result?.maxSortOrder ?? null;
  }

  async shiftSortOrders(
    userId: UserId,
    shift: SortOrderShift,
    now: Temporal.Instant,
  ): Promise<void> {
    await this.#db
      .update(memoTable)
      // 밀린 메모도 수정 시각이 바뀐다(옮기기 전 $onUpdate 동작). 앱 초안은 이 시각으로 낡음을 판단한다
      .set({ sortOrder: sql`${memoTable.sortOrder} + ${shift.delta}`, updatedAt: now })
      .where(
        and(
          eq(memoTable.userId, userId.value),
          gte(memoTable.sortOrder, shift.fromSortOrder),
          shift.toSortOrder == null ? undefined : lte(memoTable.sortOrder, shift.toSortOrder),
        ),
      );
  }

  async save(memo: Memo): Promise<void> {
    const row = toMemoRow(memo);
    await this.#db
      .insert(memoTable)
      .values(row)
      .onConflictDoUpdate({
        target: memoTable.id,
        set: {
          content: row.content,
          isPinned: row.isPinned,
          sortOrder: row.sortOrder,
          updatedAt: row.updatedAt,
        },
      });
  }

  async delete(memo: Memo): Promise<void> {
    const [deleted] = await this.#db
      .delete(memoTable)
      .where(eq(memoTable.id, memo.id.value))
      .returning({ id: memoTable.id });
    requireRecord(deleted);
  }
}
