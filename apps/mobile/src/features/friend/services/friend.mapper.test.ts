import {
  createFriendsListDto,
  createReceivedRequestsDto,
  createSendFriendRequestDto,
  createSentRequestsDto,
} from '../__tests__/friend.factories';
import {
  toFriendRequest,
  toFriendRequestsPage,
  toFriendsPage,
  toFriendUser,
  toSendRequestResult,
} from './friend.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toFriendUser', () => {
  test('friendsSince ISO → Date 변환', () => {
    // Given
    const dto = createFriendsListDto().friends[0];
    if (!dto) {
      throw new Error('Expected friend DTO');
    }

    // When
    const result = toFriendUser(dto);

    // Then
    expect(result.friendsSince).toBeInstanceOf(Date);
    expect(result.friendsSince.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(result.id).toBe(dto.id);
    expect(result.userTag).toBe(dto.userTag);
    expect(result.followId).toBe(dto.followId);
  });

  test('null 이름/프로필 유지', () => {
    // Given
    const dto = createFriendsListDto().friends[1];
    if (!dto) {
      throw new Error('Expected friend DTO');
    }

    // When
    const result = toFriendUser(dto);

    // Then
    expect(result.name).toBeNull();
    expect(result.profileImage).toBeNull();
  });
});

describe('toFriendRequest', () => {
  test('requestedAt ISO → Date 변환', () => {
    // Given
    const dto = createReceivedRequestsDto().requests[0];
    if (!dto) {
      throw new Error('Expected request DTO');
    }

    // When
    const result = toFriendRequest(dto);

    // Then
    expect(result.requestedAt).toBeInstanceOf(Date);
    expect(result.requestedAt.toISOString()).toBe('2026-03-01T10:00:00.000Z');
    expect(result.id).toBe(dto.id);
    expect(result.userTag).toBe(dto.userTag);
  });
});

describe('toFriendsPage', () => {
  test('배열 변환 + totalCount/hasMore', () => {
    // Given
    const dto = createFriendsListDto();

    // When
    const result = toFriendsPage(dto);

    // Then
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.friendsSince).toBeInstanceOf(Date);
    expect(result.totalCount).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  test('빈 배열', () => {
    // Given
    const dto = createFriendsListDto({ friends: [], totalCount: 0 });

    // When
    const result = toFriendsPage(dto);

    // Then
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});

describe('toFriendRequestsPage', () => {
  test('ReceivedRequests 변환', () => {
    // Given
    const dto = createReceivedRequestsDto();

    // When
    const result = toFriendRequestsPage(dto);

    // Then
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.requestedAt).toBeInstanceOf(Date);
    expect(result.totalCount).toBe(1);
  });

  test('SentRequests 변환', () => {
    // Given
    const dto = createSentRequestsDto();

    // When
    const result = toFriendRequestsPage(dto);

    // Then
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe('이영희');
  });
});

describe('toSendRequestResult', () => {
  test('autoAccepted 매핑', () => {
    // Given
    const dto = createSendFriendRequestDto({ autoAccepted: true });

    // When
    const result = toSendRequestResult(dto);

    // Then
    expect(result.autoAccepted).toBe(true);
  });
});
