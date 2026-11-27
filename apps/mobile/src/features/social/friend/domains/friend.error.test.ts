import { ErrorCode } from '@aido/api/errors';
import { createApiError } from '@src/testing/core';

import { findFriendLimit, getFriendLimit } from './friend.error';

describe('findFriendLimit', () => {
  it('서버가 친구 한도 details를 실어 보내면 그 인원을 반환한다', () => {
    // Given
    const error = createApiError(ErrorCode.FOLLOW_0909, {
      message: '친구 한도',
      details: { current: 7, limit: 7 },
    });

    // When
    const limit = findFriendLimit(error);

    // Then
    expect(limit).toBe(7);
  });

  it('details가 한도 모양이 아니면 null을 반환한다', () => {
    // Given
    const error = createApiError(ErrorCode.FOLLOW_0909, {
      message: '친구 한도',
      details: { limit: 'many' },
    });

    // When
    const limit = findFriendLimit(error);

    // Then
    expect(limit).toBeNull();
  });

  it('details가 없는 서버 오류는 null을 반환한다', () => {
    // Given
    const error = createApiError(ErrorCode.FOLLOW_0909, { message: '친구 한도' });

    // When
    const limit = findFriendLimit(error);

    // Then
    expect(limit).toBeNull();
  });

  it('서버 오류가 아니면 null을 반환한다', () => {
    // Given
    const error = new Error('network');

    // When
    const limit = findFriendLimit(error);

    // Then
    expect(limit).toBeNull();
  });
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
