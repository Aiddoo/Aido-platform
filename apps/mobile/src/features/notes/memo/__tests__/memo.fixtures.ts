import { memoMutationResponseSchema } from '@aido/api/contracts/memo/v1';
import { defineFixture } from '@src/testing/fixture';

import { memoSchema } from '../domains/memo.model';

export const createMemoMutationResponseDto = defineFixture(memoMutationResponseSchema, {
  message: 'created',
  memo: {
    id: 9,
    userId: 'clz7x5p8k0001qz0z8z8z8z8z',
    content: '새 메모',
    isPinned: false,
    sortOrder: 0,
    createdAt: '2026-11-06T00:00:00.000Z',
    updatedAt: '2026-11-06T00:00:00.000Z',
  },
});

export const createMemo = defineFixture(memoSchema, {
  id: 1,
  content: '장보기',
  isPinned: false,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});
