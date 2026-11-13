import { createDraftKey } from '@src/shared/draft/draft.model';
import type { DraftService } from '@src/shared/draft/draft.service';

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

/**
 * 같은 글을 다시 저장하면 앞 요청의 키를, 글이 바뀌었으면 새 키를 준다.
 * 바뀐 글에 옛 키를 쓰면 늦게 저장된 첫 메모를 돌려받아 고친 글이 저장되지 않는다
 */
export function restoreOrCreateMemoCreateIdempotencyKey(
  draftService: Pick<DraftService, 'restore' | 'save'>,
  {
    userId,
    content,
    createIdempotencyKey,
  }: { userId: string; content: string; createIdempotencyKey: () => string },
): string {
  const draftKey = createMemoCreateRequestDraftKey({ userId });
  const restored = draftService.restore(draftKey);
  if (restored.status === 'restored' && restored.value.content === content) {
    return restored.value.idempotencyKey;
  }
  const idempotencyKey = createIdempotencyKey();
  draftService.save(draftKey, { content, idempotencyKey });
  return idempotencyKey;
}
