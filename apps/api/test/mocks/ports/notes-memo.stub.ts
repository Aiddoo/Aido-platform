import { ErrorCode } from "@aido/api/errors";

import type {
  FindMemosParams,
  MemoRepositoryPort,
} from "#api/modules/notes/application/ports/memos/memo.repository.port";
import { Memo } from "#api/modules/notes/domain/aggregates/memos/memo.aggregate";
import type { MemoRecord } from "#api/modules/notes/domain/records/memos/memo.record";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { MemoBuilder } from "#test/builders/memo.builder";

export class StubMemoRepository implements MemoRepositoryPort {
  readonly records = new Map<number, MemoRecord>();
  page: readonly MemoRecord[] | undefined;

  seed(record: MemoRecord): void {
    this.records.set(record.id, structuredClone(record));
  }

  async create(userId: string, content: string, sortOrder: number): Promise<Memo> {
    const record = MemoBuilder.create(userId).withContent(content).withSortOrder(sortOrder).build();
    this.seed(record);
    return Memo.reconstitute(record);
  }

  async findByIdAndUserId(memoId: number, userId: string): Promise<Memo | null> {
    const record = this.records.get(memoId);
    return record?.userId === userId ? Memo.reconstitute(record) : null;
  }

  async findManyByUserId(params: FindMemosParams): Promise<Memo[]> {
    const records =
      this.page ?? [...this.records.values()].filter((record) => record.userId === params.userId);
    return records.slice(0, params.size + 1).map((record) => Memo.reconstitute(record));
  }

  async countByUserId(userId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.userId === userId).length;
  }

  async updateContent(memoId: number, content: string): Promise<Memo> {
    return this.#update(memoId, { content });
  }

  async updatePinned(memoId: number, isPinned: boolean): Promise<Memo> {
    return this.#update(memoId, { isPinned });
  }

  async updateSortOrder(memoId: number, sortOrder: number): Promise<Memo> {
    return this.#update(memoId, { sortOrder });
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    return Math.max(
      -1,
      ...[...this.records.values()]
        .filter((record) => record.userId === userId)
        .map((record) => record.sortOrder),
    );
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<void> {
    for (const record of this.records.values()) {
      if (
        record.userId === userId &&
        record.sortOrder >= fromSortOrder &&
        (toSortOrder === null || record.sortOrder <= toSortOrder)
      ) {
        this.#update(record.id, { sortOrder: record.sortOrder + delta });
      }
    }
  }

  async delete(memoId: number): Promise<void> {
    if (!this.records.delete(memoId))
      throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
  }

  #update(
    memoId: number,
    patch: Partial<Pick<MemoRecord, "content" | "isPinned" | "sortOrder">>,
  ): Memo {
    const record = this.records.get(memoId);
    if (record === undefined) throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
    const updated = { ...record, ...patch, updatedAt: new Date() };
    this.seed(updated);
    return Memo.reconstitute(updated);
  }
}
