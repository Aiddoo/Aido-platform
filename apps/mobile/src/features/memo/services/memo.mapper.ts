import type { Memo, MemoListResponse, MemoResourceLimitResponse } from '@aido/validators';

import type { MemoItem, MemoPage, MemoResourceLimit } from '../models/memo.model';

export const toMemoItem = (dto: Memo): MemoItem => ({
  id: dto.id,
  content: dto.content,
  isPinned: dto.isPinned,
  sortOrder: dto.sortOrder,
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

export const toMemoPage = (dto: MemoListResponse): MemoPage => ({
  items: dto.items.map(toMemoItem),
  pagination: dto.pagination,
});

export const toMemoResourceLimit = (dto: MemoResourceLimitResponse): MemoResourceLimit => ({
  currentCount: dto.currentCount,
  maxPerUser: dto.maxPerUser,
});
