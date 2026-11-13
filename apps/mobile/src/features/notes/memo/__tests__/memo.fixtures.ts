import { defineFixture } from '@src/testing/fixture';

import { memoSchema } from '../domains/memo.model';

export const createMemo = defineFixture(memoSchema, {
  id: 1,
  content: '장보기',
  isPinned: false,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});
