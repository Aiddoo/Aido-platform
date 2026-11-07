import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/shared/errors';

import { getFriendLimitFromError } from './friend.error';

describe('getFriendLimitFromError', () => {
  it('서버가 친구 한도 details를 실어 보내면 그 인원을 반환한다', () => {
    // Given
    const error = new ApiError(ErrorCode.FOLLOW_0909, '친구 한도', 403, { current: 7, limit: 7 });

    // When
    const limit = getFriendLimitFromError(error);

    // Then
    expect(limit).toBe(7);
  });

  it('details가 한도 모양이 아니면 null을 반환한다', () => {
    // Given
    const error = new ApiError(ErrorCode.FOLLOW_0909, '친구 한도', 403, { limit: 'many' });

    // When
    const limit = getFriendLimitFromError(error);

    // Then
    expect(limit).toBeNull();
  });

  it('details가 없는 서버 오류는 null을 반환한다', () => {
    // Given
    const error = new ApiError(ErrorCode.FOLLOW_0909, '친구 한도', 403);

    // When
    const limit = getFriendLimitFromError(error);

    // Then
    expect(limit).toBeNull();
  });

  it('서버 오류가 아니면 null을 반환한다', () => {
    // Given
    const error = new Error('network');

    // When
    const limit = getFriendLimitFromError(error);

    // Then
    expect(limit).toBeNull();
  });
});
