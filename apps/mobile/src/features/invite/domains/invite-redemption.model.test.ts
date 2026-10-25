import { createPendingRedemption } from '../__tests__/invite.factories';
import { isWithinDays, InviteRedemptionPolicy } from './invite-redemption.model';

describe('isWithinDays', () => {
  it('정확히 기간만큼 지나면 false를 반환한다', () => {
    // When
    const result = isWithinDays(
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-08T00:00:00Z'),
      7,
    );

    // Then 7일 = 7 × 24시간, 기간 안이 아니다
    expect(result).toBe(false);
  });

  it('기간이 1ms 남았으면 true를 반환한다', () => {
    // When
    const result = isWithinDays(
      new Date('2026-10-01T00:00:00.000Z'),
      new Date('2026-10-07T23:59:59.999Z'),
      7,
    );

    // Then
    expect(result).toBe(true);
  });
});

describe('InviteRedemptionPolicy', () => {
  describe('isFresh', () => {
    it('저장한 지 7일이 안 됐으면 true를 반환한다', () => {
      // Given
      const pending = createPendingRedemption({ savedAt: new Date('2028-02-23T00:00:00Z') });

      // When
      const result = InviteRedemptionPolicy.isFresh(pending, new Date('2028-02-29T23:59:59Z'));

      // Then 윤년 2월 29일까지 포함해 6일 23시간 59분 59초
      expect(result).toBe(true);
    });

    it('저장한 지 정확히 7일이 지나면 false를 반환한다', () => {
      // Given
      const pending = createPendingRedemption({ savedAt: new Date('2028-02-23T00:00:00Z') });

      // When
      const result = InviteRedemptionPolicy.isFresh(pending, new Date('2028-03-01T00:00:00Z'));

      // Then 2월 23일 + 7일 = 3월 1일 (윤년)
      expect(result).toBe(false);
    });
  });
});
