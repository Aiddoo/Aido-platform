import { FriendPolicy } from './friend.model';

describe('hasValidSearchQuery', () => {
  it.each([
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
});

describe('hasValidUserTag', () => {
  it.each([
    ['ABCD1234', true],
    [' ABCD1234 ', true],
    ['abcd1234', false],
    ['ABC123', false],
  ])('태그 "%s"의 유효 여부는 %s이다', (userTag, expected) => {
    // Given
    const user = { userTag };

    // When
    const result = FriendPolicy.hasValidUserTag(user);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getRequestState', () => {
  it.each([
    { isFriend: true, requestPending: false, expected: 'friend' },
    { isFriend: true, requestPending: true, expected: 'friend' },
    { isFriend: false, requestPending: true, expected: 'pending' },
    { isFriend: false, requestPending: false, expected: 'none' },
  ] as const)(
    '친구 $isFriend, 요청 대기 $requestPending이면 $expected로 본다',
    ({ expected, ...user }) => {
      // When
      const state = FriendPolicy.getRequestState(user);

      // Then
      expect(state).toBe(expected);
    },
  );
});

describe('getFriendLimitOffer', () => {
  it('초대를 쓸 수 있으면 서버가 알려 준 한도로 초대 안내를 반환한다', () => {
    // When
    const offer = FriendPolicy.getFriendLimitOffer({
      isInviteAvailable: true,
      serverLimit: 6,
      knownLimit: 5,
    });

    // Then
    expect(offer).toEqual({ type: 'invite', limit: 6 });
  });

  it('초대를 쓸 수 있는데 오류에 한도가 없으면 내 정보의 한도로 초대 안내를 반환한다', () => {
    // Given
    // 초대로 한 자리 늘어 서버 entitlements가 6명이다
    const input = { isInviteAvailable: true, serverLimit: null, knownLimit: 6 };

    // When
    const offer = FriendPolicy.getFriendLimitOffer(input);

    // Then
    expect(offer).toEqual({ type: 'invite', limit: 6 });
  });

  it('내 정보에도 한도가 없는 구버전 서버면 카탈로그의 무료 한도로 안내한다', () => {
    // Given
    const input = { isInviteAvailable: true, serverLimit: null, knownLimit: null };

    // When
    const offer = FriendPolicy.getFriendLimitOffer(input);

    // Then
    // PREMIUM_FEATURES.FRIEND.free
    expect(offer).toEqual({ type: 'invite', limit: 5 });
  });

  it('초대를 쓸 수 없으면 구독 안내를 반환한다', () => {
    // Given
    const input = { isInviteAvailable: false, serverLimit: 6, knownLimit: 5 };

    // When
    const offer = FriendPolicy.getFriendLimitOffer(input);

    // Then
    expect(offer).toEqual({ type: 'subscribe' });
  });
});
