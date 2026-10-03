import type { FriendUser } from '../../models/friend.model';
import { findFriendById } from './find-friend-by-id';

const createFriend = (id: string): FriendUser => ({
  id,
  followId: `follow-${id}`,
  userTag: 'ABCD1234',
  name: '친구',
  profileImage: null,
  friendsSince: new Date('2026-10-03T00:00:00Z'),
});

describe('무한 쿼리 페이지에서 친구 선택', () => {
  it('첫 페이지에 없는 친구도 뒤 페이지에서 찾는다', () => {
    // Given
    const friend = createFriend('later');
    const pages = [{ items: [createFriend('first')] }, { items: [friend] }];

    // When
    const selected = findFriendById(pages, 'later');

    // Then
    expect(selected).toBe(friend);
    expect(pages[1]?.items).toEqual([friend]);
  });

  it('빈 페이지가 사이에 있어도 다음 페이지의 친구를 찾는다', () => {
    // Given
    const friend = createFriend('later');
    const pages = [{ items: [] }, { items: [friend] }];

    // When
    const selected = findFriendById(pages, 'later');

    // Then
    expect(selected).toBe(friend);
  });

  it('이미 받아 둔 페이지에 친구가 없으면 null을 반환한다', () => {
    // Given
    const pages = [{ items: [createFriend('first')] }];

    // When
    const selected = findFriendById(pages, 'missing');

    // Then
    expect(selected).toBeNull();
  });
});
