import type {
  CreateMemoInput,
  Memo as MemoDto,
  MemoListResponse,
  MemoResourceLimitResponse,
} from '@aido/api';
import { pick } from 'es-toolkit';

import type { MemoFormValues } from '../domains/memo-form.schema';
import type { Memo, MemoPage, MemoResourceLimit } from '../domains/memo.model';

export function toMemo(dto: MemoDto): Memo {
  return {
    ...pick(dto, ['id', 'content', 'isPinned']),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function toMemoPage(dto: MemoListResponse): MemoPage {
  return {
    items: dto.items.map(toMemo),
    nextCursor: dto.pagination.nextCursor,
    hasNext: dto.pagination.hasNext,
  };
}

export function toMemoResourceLimit(dto: MemoResourceLimitResponse): MemoResourceLimit {
  return pick(dto, ['currentCount', 'maxPerUser']);
}

export function toMemoRequest({ content }: MemoFormValues): CreateMemoInput {
  return { content };
}
