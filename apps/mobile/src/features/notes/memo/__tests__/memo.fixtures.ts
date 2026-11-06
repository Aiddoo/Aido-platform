import { type Memo, memoSchema } from '../schemas/memo.schema';

const DEFAULT_MEMO = memoSchema.parse({
  id: 1,
  content: '장보기',
  isPinned: false,
  createdAt: new Date('2026-11-06T00:00:00.000Z'),
  updatedAt: new Date('2026-11-06T00:00:00.000Z'),
});

export function createMemo(overrides: Partial<Memo> = {}): Memo {
  return { ...DEFAULT_MEMO, ...overrides };
}
