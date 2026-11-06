import { createDraftKey } from '@src/shared/draft/draft.model';
import { z } from 'zod';

const memoDraftSchema = z.object({ content: z.string() });

export function createMemoDraftKey({ userId, memoId }: { userId: string; memoId?: number }) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo',
    target: memoId == null ? ['create'] : ['edit', memoId],
    schema: memoDraftSchema,
  });
}
