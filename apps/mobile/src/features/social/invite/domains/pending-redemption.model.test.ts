import { toInstant } from '@src/shared/date/instant';

import { createPendingRedemption } from '../__tests__/invite.fixtures';
import { PendingRedemptionPolicy } from './pending-redemption.model';

describe('isFresh', () => {
  it('저장한 지 7일이 안 됐으면 true를 반환한다', () => {
    // Given
    const pending = createPendingRedemption({ savedAt: toInstant('2028-02-23T00:00:00Z') });

    // When
    const result = PendingRedemptionPolicy.isFresh(pending, toInstant('2028-02-29T23:59:59Z'));

    // Then
    // 윤년 2월 29일까지 포함해 6일 23시간 59분 59초
    expect(result).toBe(true);
  });

  it('저장한 지 정확히 7일이 지나면 false를 반환한다', () => {
    // Given
    const pending = createPendingRedemption({ savedAt: toInstant('2028-02-23T00:00:00Z') });

    // When
    const result = PendingRedemptionPolicy.isFresh(pending, toInstant('2028-03-01T00:00:00Z'));

    // Then
    // 2월 23일 + 7일 = 3월 1일 (윤년)
    expect(result).toBe(false);
  });
});
