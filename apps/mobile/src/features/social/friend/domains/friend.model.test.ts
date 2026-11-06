import { getFriendLimit, getFriendLimitDialog, FriendPolicy } from './friend.model';

describe('친구 검색 정책', () => {
  test.each([
    ['홍길', true],
    ['ab', true],
    ['  홍길동  ', true],
    ['a', false],
    [' a ', false],
    ['', false],
  ])('검색어 "%s"의 검색 가능 여부는 %s이다', (query, expected) => {
    // Given
    const input = { query };
    // When
    const result = FriendPolicy.hasValidSearchQuery(input);
    // Then
    expect(result).toBe(expected);
  });

  test.each([
    ['ABCD1234', true],
    [' ABCD1234 ', true],
    ['abcd1234', false],
    ['ABC123', false],
  ])('태그 "%s"의 유효 여부는 %s이다', (userTag, expected) => {
    // Given
    const input = { userTag };
    // When
    const result = FriendPolicy.hasValidUserTag(input);
    // Then
    expect(result).toBe(expected);
  });
});

describe('getFriendLimit', () => {
  it('서버가 늘어난 한도를 알려 주면 그 인원을 반환한다', () => {
    // When
    const result = getFriendLimit({ current: 7, limit: 7 }, 5);

    // Then
    expect(result).toBe(7);
  });

  it('오류에 한도가 없으면 내 정보의 친구 한도를 반환한다', () => {
    // When 초대로 한 자리 늘어 서버 entitlements가 6명이다
    const result = getFriendLimit(undefined, 6);

    // Then
    expect(result).toBe(6);
  });

  it('내 정보에도 한도가 없는 구버전 서버면 카탈로그의 무료 한도를 반환한다', () => {
    // When
    const result = getFriendLimit(undefined, null);

    // Then PREMIUM_FEATURES.FRIEND.free
    expect(result).toBe(5);
  });
});

describe('getFriendLimitDialog', () => {
  it('초대를 쓸 수 있으면 서버가 알려 준 한도로 초대 안내를 반환한다', () => {
    // When
    const result = getFriendLimitDialog({ current: 6, limit: 6 }, true, 5);

    // Then
    expect(result).toEqual({ type: 'invite', limit: 6 });
  });

  it('초대를 쓸 수 있는데 오류에 한도가 없으면 내 정보의 한도로 초대 안내를 반환한다', () => {
    // When
    const result = getFriendLimitDialog(undefined, true, 5);

    // Then
    expect(result).toEqual({ type: 'invite', limit: 5 });
  });

  it('초대를 쓸 수 없으면 구독 안내를 반환한다', () => {
    // When
    const result = getFriendLimitDialog({ current: 6, limit: 6 }, false, 5);

    // Then
    expect(result).toEqual({ type: 'subscribe' });
  });
});

describe('getRequestState', () => {
  test.each([
    { isFriend: true, requestPending: false, expected: 'friend' },
    { isFriend: true, requestPending: true, expected: 'friend' },
    { isFriend: false, requestPending: true, expected: 'pending' },
    { isFriend: false, requestPending: false, expected: 'none' },
  ] as const)(
    '친구 $isFriend, 요청 대기 $requestPending이면 $expected로 본다',
    ({ expected, ...user }) => {
      // Given
      // When
      const state = FriendPolicy.getRequestState(user);

      // Then
      expect(state).toBe(expected);
    },
  );
});
