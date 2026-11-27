import { createDraftKey } from '@src/shared/draft/draft.model';

import { memoCreateRequestDraftSchema, memoDraftSchema } from '../schemas/memo-draft.schema';

export function createMemoDraftKey({ userId, memoId }: { userId: string; memoId?: number }) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo',
    target: memoId == null ? ['create'] : ['edit', memoId],
    schema: memoDraftSchema,
  });
}

/** 응답을 받지 못한 새 메모 저장의 키. 앱을 다시 켜고 다시 저장해도 같은 키를 보내야 메모가 하나만 생긴다 */
export function createMemoCreateRequestDraftKey({ userId }: { userId: string }) {
  return createDraftKey({
    ownerId: userId,
    scope: 'memo-create-request',
    target: ['create'],
    schema: memoCreateRequestDraftSchema,
  });
}
