import type { InfiniteData } from '@tanstack/react-query';

import { createFriendUser } from '../__tests__/friend.fixtures';
import type { FriendUser, FriendUserPage } from '../domains/friend.model';
import { withFriendRemoved, withFriendRestored } from './friend-cache';

function createFriendPages(
  ...pages: FriendUser[][]
): InfiniteData<FriendUserPage, string | undefined> {
  return {
    pages: pages.map((items) => ({
      items,
      // 받은 쪽은 모두 다음 쪽이 있다고 둔다. 마지막 친구의 followId가 다음 커서다
      nextCursor: items.at(-1)?.followId ?? null,
      totalCount: 10,
    })),
    pageParams: pages.map(() => undefined),
  };
}

describe('withFriendRemoved', () => {
  it('쪽의 마지막 친구를 빼면 그 앞 친구의 followId로 다음 커서를 다시 맞춘다', () => {
    // Given
    const pages = createFriendPages([createFriendUser('a'), createFriendUser('b')]);

    // When
    const removed = withFriendRemoved(pages, 'b');

    // Then
    expect(removed.pages[0]?.nextCursor).toBe('follow-a');
  });

  it('마지막 쪽이 비면 앞 쪽의 마지막 친구에서 이어 받는다', () => {
    // Given
    const pages = createFriendPages([createFriendUser('a')], [createFriendUser('b')]);

    // When
    const removed = withFriendRemoved(pages, 'b');

    // Then
    expect(removed.pages[1]).toMatchObject({ items: [], nextCursor: 'follow-a' });
  });

  it('받은 친구가 하나도 남지 않으면 이을 기준이 없어 커서를 그대로 두고 되돌리면 이어 받는다', () => {
    // Given
    const friend = createFriendUser('a');
    const pages = createFriendPages([friend]);

    // When
    const removed = withFriendRemoved(pages, 'a');
    const restored = withFriendRestored(removed, { friend, pageIndex: 0, index: 0 });

    // Then
    expect(removed.pages[0]).toMatchObject({ items: [], nextCursor: 'follow-a' });
    expect(restored.pages[0]?.nextCursor).toBe('follow-a');
  });

  it('마지막 쪽이면 커서를 만들지 않는다', () => {
    // Given
    const pages = createFriendPages([createFriendUser('a'), createFriendUser('b')]);
    const lastPage = {
      ...pages,
      pages: pages.pages.map((page) => ({ ...page, nextCursor: null })),
    };

    // When
    const removed = withFriendRemoved(lastPage, 'b');

    // Then
    expect(removed.pages[0]?.nextCursor).toBeNull();
  });
});

describe('withFriendRestored', () => {
  it('지우기가 실패해 쪽 끝에 돌아온 친구의 followId로 다음 커서를 되돌린다', () => {
    // Given
    const friend = createFriendUser('b');
    const removed = withFriendRemoved(createFriendPages([createFriendUser('a'), friend]), 'b');

    // When
    const restored = withFriendRestored(removed, { friend, pageIndex: 0, index: 1 });

    // Then
    expect(restored.pages[0]).toMatchObject({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: 'follow-b',
      totalCount: 10,
    });
  });
});
