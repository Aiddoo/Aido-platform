import { ErrorCode } from '@aido/api/errors';
import { createApiError } from '@src/testing/core';

import { findFriendLimit } from './friend.error';

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
