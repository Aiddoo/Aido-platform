import {
  createFriendsListDto,
  createReceivedRequestsDto,
  createSearchUsersDto,
  createSentRequestsDto,
} from '../__tests__/friend.fixtures';
import {
  friendRequestsPageSchema,
  friendsPageSchema,
  searchedUsersPageSchema,
} from '../schemas/friend.schema';
import { toFriendRequestsPage, toFriendsPage, toSearchedUsersPage } from './friend.mapper';

describe('toFriendsPage', () => {
  it('친구 목록과 totalCount, hasMore를 옮기고 친구가 된 시각은 순간으로 읽는다', () => {
    // Given
    const dto = friendsPageSchema.parse(createFriendsListDto());

    // When
    const page = toFriendsPage(dto);

    // Then
    expect(page.items).toHaveLength(dto.friends.length);
    expect(page.items[0]?.friendsSince).toBe('2026-01-15T00:00:00.000Z');
    expect(page.totalCount).toBe(dto.totalCount);
    expect(page.hasMore).toBe(dto.hasMore);
  });

  it('이름과 프로필이 없는 친구도 null 그대로 둔다', () => {
    // Given
    const dto = friendsPageSchema.parse(createFriendsListDto());

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
    const received = friendRequestsPageSchema.parse(createReceivedRequestsDto());
    const sent = friendRequestsPageSchema.parse(createSentRequestsDto());

    // When
    const receivedPage = toFriendRequestsPage(received);
    const sentPage = toFriendRequestsPage(sent);

    // Then
    expect(receivedPage.items).toHaveLength(received.requests.length);
    expect(sentPage.items).toHaveLength(sent.requests.length);
    expect(receivedPage.items[0]?.requestedAt).toBe(received.requests[0]?.requestedAt);
  });
});

describe('toSearchedUsersPage', () => {
  it('관계 flag를 보존하고 nextCursor를 전달한다', () => {
    // Given
    const dto = searchedUsersPageSchema.parse(createSearchUsersDto());

    // When
    const page = toSearchedUsersPage(dto);

    // Then
    expect(page.items.map((user) => user.isFriend)).toEqual(dto.items.map((user) => user.isFriend));
    expect(page.nextCursor).toBe(dto.nextCursor);
  });
});
