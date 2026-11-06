import { createDraftKey } from '@src/shared/draft/draft.model';

import { memoDraftSchema } from '../schemas/memo-draft.schema';

export function createMemoDraftKey({ userId, memoId }: { userId: string; memoId?: number }) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo',
    target: memoId == null ? ['create'] : ['edit', memoId],
    schema: memoDraftSchema,
  });
}
