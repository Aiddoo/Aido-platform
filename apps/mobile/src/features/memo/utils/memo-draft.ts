import { createDraftKey } from '@src/shared/draft/draft.model';
import { z } from 'zod';

const memoDraftSchema = z.object({ content: z.string() });

interface CreateMemoDraftKeyInput {
  userId: string;
  /** 없으면 새 메모 작성 초안이다. */
  memoId?: number;
}

export function createMemoDraftKey({ userId, memoId }: CreateMemoDraftKeyInput) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo',
    target: memoId == null ? ['create'] : ['edit', memoId],
    schema: memoDraftSchema,
  });
}
