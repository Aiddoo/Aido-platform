import {
  createFriendsListDto,
  createReceivedRequestsDto,
  createReorderFriendDto,
  createSearchUsersDto,
  createSendFriendRequestDto,
  createSentRequestsDto,
} from '../__tests__/friend.fixtures';
import { friendRequestSchema, friendUserSchema, searchedUserSchema } from '../domains/friend.model';
import {
  toFriendRequestsPage,
  toFriendsPage,
  toFriendUser,
  toSearchedUsersPage,
  toSendFriendRequestResult,
} from './friend.mapper';

describe('toFriendsPage', () => {
  it('친구 목록과 totalCount를 옮기고 친구가 된 시각은 순간으로 읽는다', () => {
    // Given
    const dto = createFriendsListDto();

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.items).toHaveLength(dto.friends.length);
    expect(page.items[0]?.friendsSince).toBe('2026-01-15T00:00:00.000Z');
    expect(page.totalCount).toBe(dto.totalCount);
  });

  it('다음 쪽이 있으면 마지막 친구의 followId가 다음 커서다', () => {
    // Given
    const dto = createFriendsListDto({ hasMore: true });

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.nextCursor).toBe(dto.friends.at(-1)?.followId);
  });

  it.each([
    { name: '마지막 쪽', overrides: { hasMore: false } },
    { name: '다음 쪽이 있다는데 빈 쪽', overrides: { hasMore: true, friends: [] } },
  ])('$name이면 다음 커서가 없다', ({ overrides }) => {
    // Given
    const dto = createFriendsListDto(overrides);

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.nextCursor).toBeNull();
  });

  it('계약을 통과한 응답은 앱 친구 모델도 통과한다', () => {
    // Given
    const dto = createFriendsListDto();

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.items.map((friend) => friendUserSchema.parse(friend))).toEqual(page.items);
  });

  it('이름과 프로필이 없는 친구도 null 그대로 둔다', () => {
    // Given
    const dto = createFriendsListDto();

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.items[1]?.name).toBeNull();
    expect(page.items[1]?.profileImage).toBeNull();
  });
});

describe('toFriendRequestsPage', () => {
  it('받은 요청과 보낸 요청을 같은 모양으로 옮긴다', () => {
    // Given
    const received = createReceivedRequestsDto();
    const sent = createSentRequestsDto();

    // When
    const receivedPage = toFriendRequestsPage(received);
    const sentPage = toFriendRequestsPage(sent);

    // Then
    expect(receivedPage.items).toHaveLength(received.requests.length);
    expect(sentPage.items).toHaveLength(sent.requests.length);
    expect(receivedPage.items[0]?.requestedAt).toBe(received.requests[0]?.requestedAt);
    expect(friendRequestSchema.parse(sentPage.items[0])).toEqual(sentPage.items[0]);
  });
});

describe('toSearchedUsersPage', () => {
  it('관계 flag를 보존하고 nextCursor를 전달한다', () => {
    // Given
    const dto = createSearchUsersDto();

    // When
    const page = toSearchedUsersPage(dto);

    // Then
    expect(page.items.map((user) => user.isFriend)).toEqual(dto.items.map((user) => user.isFriend));
    expect(page.nextCursor).toBe(dto.nextCursor);
  });

  it('앱이 쓰지 않는 팔로우 방향 칸은 모델에 옮기지 않는다', () => {
    // Given
    const dto = createSearchUsersDto();

    // When
    const [user] = toSearchedUsersPage(dto).items;

    // Then
    expect(user).not.toHaveProperty('isFollowing');
    expect(searchedUserSchema.parse(user)).toEqual(user);
  });
});

describe('toFriendUser', () => {
  it('순서를 바꾼 친구 응답을 친구 모델로 옮긴다', () => {
    // Given
    const dto = createReorderFriendDto();

    // When
    const friend = toFriendUser(dto.friend);

    // Then
    expect(friend).toEqual({
      id: 'clz7x5p8k0005qz0z8z8z8z8z',
      followId: 'clz7x5p8k0010qz0z8z8z8z8z',
      userTag: 'JOHN2026',
      name: '존',
      profileImage: 'https://example.com/profiles/john.jpg',
      friendsSince: '2026-01-15T10:35:00.000Z',
    });
  });
});

describe('toSendFriendRequestResult', () => {
  it('자동 수락 여부만 옮긴다', () => {
    // Given
    const dto = createSendFriendRequestDto({ autoAccepted: true });

    // When
    const result = toSendFriendRequestResult(dto);

    // Then
    expect(result).toEqual({ autoAccepted: true });
  });
});
