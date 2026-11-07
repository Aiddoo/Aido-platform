import { ApiError } from '@src/core/errors/api-error';

import { canRetryPlanFailure, getVoicePlanFailureCause } from './voice.error';

describe('getVoicePlanFailureCause', () => {
  it('메모 개수 한도(MEMO_2003)는 다시 시도가 아니라 메모 정리로 안내할 원인이다', () => {
    // Given
    const error = new ApiError('MEMO_2003', '한도', 403);

    // When
    const cause = getVoicePlanFailureCause(error);

    // Then
    expect(cause).toBe('memo-limit');
  });
});

describe('canRetryPlanFailure', () => {
  it('너무 긴 글은 다시 보내도 소용없다', () => {
    // When
    const result = canRetryPlanFailure('too-long');

    // Then
    expect(result).toBe(false);
  });

  it('네트워크 실패는 다시 보낼 수 있다', () => {
    // When
    const result = canRetryPlanFailure('network');

    // Then
    expect(result).toBe(true);
  });
});
