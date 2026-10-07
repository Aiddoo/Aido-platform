import type { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";

export interface FindMemosParams {
  readonly userId: string;
  readonly cursor?: number;
  readonly size: number;
}

export interface MemoRepositoryPort {
  create(userId: string, content: string, sortOrder: number): Promise<Memo>;
  findByIdAndUserId(memoId: number, userId: string): Promise<Memo | null>;
  findManyByUserId(params: FindMemosParams): Promise<Memo[]>;
  countByUserId(userId: string): Promise<number>;
  updateContent(memoId: number, content: string): Promise<Memo>;
  updatePinned(memoId: number, isPinned: boolean): Promise<Memo>;
  updateSortOrder(memoId: number, sortOrder: number): Promise<Memo>;
  getMaxSortOrder(userId: string): Promise<number>;
  shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<void>;
  delete(memoId: number): Promise<void>;
}

export const MEMO_REPOSITORY = Symbol("MEMO_REPOSITORY");
