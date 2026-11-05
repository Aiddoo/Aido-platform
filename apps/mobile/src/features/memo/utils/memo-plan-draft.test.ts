import { createMemorySyncStorage } from '@src/shared/__tests__';
import { createDraftRepository } from '@src/shared/draft/draft.repository';
import { DraftService } from '@src/shared/draft/draft.service';

import { createMemoPlanRequestDraftKey, prepareMemoPlanIdempotencyKey } from './memo-plan-draft';

const NOW = Date.UTC(2026, 10, 5);
const request = { userId: 'user-1', memoId: 7, content: '메모', categoryId: 1, sourceUpdatedAt: 1 };

function createFixture() {
  const storage = createMemorySyncStorage();
  const openDraftService = () => new DraftService(createDraftRepository(storage), () => NOW);
  let sequence = 0;
  const createIdempotencyKey = () => `key-${++sequence}`;
  return { draftService: openDraftService(), openDraftService, createIdempotencyKey };
}

describe('prepareMemoPlanIdempotencyKey', () => {
  test('응답을 받지 못하고 앱을 다시 켜도 같은 메모는 같은 키를 쓴다', () => {
    // Given
    const { draftService, openDraftService, createIdempotencyKey } = createFixture();
    const first = prepareMemoPlanIdempotencyKey(draftService, { ...request, createIdempotencyKey });

    // When
    const retried = prepareMemoPlanIdempotencyKey(openDraftService(), {
      ...request,
      createIdempotencyKey,
    });

    // Then
    expect(retried).toBe(first);
  });

  test.each([
    ['메모 내용을 고치면', { content: '고친 메모', sourceUpdatedAt: 2 }],
    ['기본 카테고리가 바뀌면', { categoryId: 2 }],
  ])('%s 새 키를 쓴다', (_label, changed) => {
    // Given
    const { draftService, createIdempotencyKey } = createFixture();
    const first = prepareMemoPlanIdempotencyKey(draftService, { ...request, createIdempotencyKey });

    // When
    const next = prepareMemoPlanIdempotencyKey(draftService, {
      ...request,
      ...changed,
      createIdempotencyKey,
    });

    // Then
    expect(next).not.toBe(first);
  });

  test('결과를 받아 키를 지우면 다음 요청은 새 키를 쓴다', () => {
    // Given
    const { draftService, createIdempotencyKey } = createFixture();
    const first = prepareMemoPlanIdempotencyKey(draftService, { ...request, createIdempotencyKey });
    draftService.remove(createMemoPlanRequestDraftKey(request));

    // When
    const next = prepareMemoPlanIdempotencyKey(draftService, { ...request, createIdempotencyKey });

    // Then
    expect(next).not.toBe(first);
  });
});
