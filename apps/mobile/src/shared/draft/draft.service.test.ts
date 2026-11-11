import { createMemorySyncStorage } from '@src/testing/core';
import { z } from 'zod';

import { createDraftKey, DRAFT_TTL_MS } from './draft.model';
import { createDraftRepository } from './draft.repository';
import { DraftService } from './draft.service';

const contentSchema = z.object({ content: z.string() });
const NOW = Date.UTC(2026, 9, 23, 12);

function createDraftService(now: () => number = () => NOW) {
  const storage = createMemorySyncStorage();
  return { storage, service: new DraftService(createDraftRepository(storage), now) };
}

function createMemoDraftKey(ownerId: string, memoId: number) {
  return createDraftKey({ ownerId, scope: 'memo', target: [memoId], schema: contentSchema });
}

describe('DraftService', () => {
  it('저장한 초안을 같은 키로 복원하고 다른 사용자 키로는 보이지 않는다', () => {
    // Given
    const { service } = createDraftService();
    service.save(createMemoDraftKey('user-1', 7), { content: '메모 초안' });

    // When
    const own = service.restore(createMemoDraftKey('user-1', 7));
    const other = service.restore(createMemoDraftKey('user-2', 7));

    // Then
    expect(own).toEqual({
      status: 'restored',
      value: { content: '메모 초안' },
    });
    expect(other).toEqual({ status: 'empty' });
  });

  it('서버 수정 시각을 함께 저장해 이후 원본이 바뀌면 초안을 버리게 한다', () => {
    // Given
    const { service } = createDraftService();
    const draftKey = createMemoDraftKey('user-1', 7);
    service.save(draftKey, { content: '수정 중' }, { sourceUpdatedAt: NOW - 10_000 });

    // When
    const result = service.restore(draftKey, { sourceUpdatedAt: NOW - 1000 });

    // Then
    expect(result).toEqual({
      status: 'discarded',
      reason: 'outdated',
    });
  });

  it('손상된 저장값은 빈 초안으로 읽는다', () => {
    // Given
    const { storage, service } = createDraftService();
    const draftKey = createMemoDraftKey('user-1', 7);
    storage.set(`aido_draft_v1:${draftKey.id}`, '{not json');

    // When
    const result = service.restore(draftKey);

    // Then
    expect(result).toEqual({ status: 'empty' });
  });

  it('만료되었거나 손상된 초안만 정리하고 나머지는 남긴다', () => {
    // Given
    let now = NOW - DRAFT_TTL_MS;
    const { storage, service } = createDraftService(() => now);
    const expiredKey = createMemoDraftKey('user-1', 1);
    const freshKey = createMemoDraftKey('user-1', 2);
    service.save(expiredKey, { content: '오래된 초안' });
    now = NOW;
    service.save(freshKey, { content: '최근 초안' });
    storage.set('aido_draft_v1:user-1:memo:3', 'broken');
    storage.set('unrelated', 'kept');

    // When
    service.removeExpired();

    // Then
    expect(storage.keys().sort()).toEqual([`aido_draft_v1:${freshKey.id}`, 'unrelated']);
  });

  it('모두 지우면 어느 사용자의 초안도 남지 않는다', () => {
    // Given
    const { service } = createDraftService();
    service.save(createMemoDraftKey('user-1', 1), { content: '하나' });
    service.save(createMemoDraftKey('user-2', 1), { content: '둘' });

    // When
    service.removeAll();

    // Then
    expect(service.restore(createMemoDraftKey('user-1', 1))).toEqual({ status: 'empty' });
    expect(service.restore(createMemoDraftKey('user-2', 1))).toEqual({ status: 'empty' });
  });

  it('현재 사용자 외 소유자의 초안만 지우고 현재 사용자의 초안은 남긴다', () => {
    // Given
    const { service } = createDraftService();
    service.save(createMemoDraftKey('user-1', 1), { content: '내 초안' });
    service.save(createMemoDraftKey('user-2', 1), { content: '이전 사용자 초안' });

    // When
    service.removeAllExceptOwner('user-1');

    // Then
    expect(service.restore(createMemoDraftKey('user-1', 1))).toEqual({
      status: 'restored',
      value: { content: '내 초안' },
    });
    expect(service.restore(createMemoDraftKey('user-2', 1))).toEqual({ status: 'empty' });
  });
});
