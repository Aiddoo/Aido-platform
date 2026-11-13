import { userTagParamSchema } from '@aido/api';

import { createSearchedUser } from '../__tests__/friend.fixtures';
import { FriendPolicy, getFriendLimit, isValidSearchQuery, isValidUserTag } from './friend.model';

describe('isValidSearchQuery', () => {
  it.each([
    ['홍길', true],
    ['ab', true],
    ['  홍길동  ', true],
    ['a', false],
    [' a ', false],
    ['', false],
  ])('검색어 "%s"의 검색 가능 여부는 %s이다', (query, expected) => {
    // When
    const result = isValidSearchQuery(query);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isValidUserTag', () => {
  it.each([
    ['ABCD1234', true],
    [' ABCD1234 ', true],
    ['abcd1234', false],
    ['ABC123', false],
    ['ABCD123', false],
    ['ABCD12345', false],
    ['ABCD-123', false],
  ])('태그 "%s"의 유효 여부는 %s이다', (userTag, expected) => {
    // When
    const result = isValidUserTag(userTag);

    // Then
    expect(result).toBe(expected);
  });

  it.each(['ABCD1234', 'abcd1234', 'ABCD123', 'ABCD12345', 'ABCD-123', ''])(
    '태그 "%s"를 서버 경로 검증과 같게 판단한다',
    (userTag) => {
      // When
      const result = isValidUserTag(userTag);

      // Then
      expect(result).toBe(userTagParamSchema.safeParse({ userTag }).success);
    },
  );
});

describe('getRequestState', () => {
  it.each([
    { isFriend: true, requestPending: false, expected: 'friend' },
    { isFriend: true, requestPending: true, expected: 'friend' },
    { isFriend: false, requestPending: true, expected: 'pending' },
    { isFriend: false, requestPending: false, expected: 'none' },
  ] as const)(
    '친구 $isFriend, 요청 대기 $requestPending이면 $expected로 본다',
    ({ expected, isFriend, requestPending }) => {
      // Given
      const user = createSearchedUser({ isFriend, requestPending });

      // When
      const state = FriendPolicy.getRequestState(user);

      // Then
      expect(state).toBe(expected);
    },
  );
});

describe('getFriendLimit', () => {
  it('서버가 알려 준 한도를 먼저 반환한다', () => {
    // When
    const limit = getFriendLimit({ serverLimit: 6, knownLimit: 5 });

    // Then
    expect(limit).toBe(6);
  });

  it('서버가 알려 준 한도가 0이어도 그 값을 반환한다', () => {
    // When
    const limit = getFriendLimit({ serverLimit: 0, knownLimit: 5 });

    // Then
    expect(limit).toBe(0);
  });

  it('오류에 한도가 없으면 내 정보의 한도를 반환한다', () => {
    // Given
    // 초대로 한 자리 늘어 서버 entitlements가 6명이다
    const input = { serverLimit: null, knownLimit: 6 };

    // When
    const limit = getFriendLimit(input);

    // Then
    expect(limit).toBe(6);
  });

  it('내 정보에도 한도가 없는 구버전 서버면 카탈로그의 무료 한도를 반환한다', () => {
    // Given
    const input = { serverLimit: null, knownLimit: null };

    // When
    const limit = getFriendLimit(input);

    // Then
    // PREMIUM_FEATURES.FRIEND.free
    expect(limit).toBe(5);
  });
});
