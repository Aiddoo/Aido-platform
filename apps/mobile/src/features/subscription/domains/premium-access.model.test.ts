import { createPremiumAccess } from '../__tests__/premium-access.factories';
import { calculateDaysLeft, PremiumAccessPolicy } from './premium-access.model';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('calculateDaysLeft', () => {
  it('자정 직전이면 끝나는 날까지 1일을 반환한다', () => {
    // Given
    const endsAt = new Date('2026-11-01T05:30:00Z'); // 11월 1일 14:30 KST
    const now = new Date('2026-10-31T14:59:59Z'); // 10월 31일 23:59:59 KST

    // When
    const result = calculateDaysLeft(endsAt, now, SEOUL);

    // Then 11월 1일 - 10월 31일 = 1일
    expect(result).toBe(1);
  });

  it('자정이 지나 끝나는 날이 되면 0일을 반환한다', () => {
    // Given
    const endsAt = new Date('2026-11-01T05:30:00Z');
    const now = new Date('2026-10-31T15:00:00Z'); // 11월 1일 00:00 KST

    // When
    const result = calculateDaysLeft(endsAt, now, SEOUL);

    // Then 11월 1일 - 11월 1일 = 0일
    expect(result).toBe(0);
  });

  it('서머타임이 끝나 25시간인 날을 지나도 달력 일수를 반환한다', () => {
    // Given 2026-11-01 미국 서머타임 종료
    const now = new Date('2026-10-31T19:00:00Z'); // 10월 31일 12:00 PDT
    const endsAt = new Date('2026-11-02T20:00:00Z'); // 11월 2일 12:00 PST

    // When
    const result = calculateDaysLeft(endsAt, now, LOS_ANGELES);

    // Then 49시간이 지나도 11월 2일 - 10월 31일 = 2일
    expect(result).toBe(2);
  });

  it('윤년 2월 29일을 하루로 센 일수를 반환한다', () => {
    // Given
    const now = new Date('2028-02-28T03:00:00Z');
    const endsAt = new Date('2028-03-01T03:00:00Z');

    // When
    const result = calculateDaysLeft(endsAt, now, SEOUL);

    // Then 2월 28일 → 2월 29일 → 3월 1일 = 2일
    expect(result).toBe(2);
  });

  it('이미 지난 날이면 0일을 반환한다', () => {
    // Given
    const endsAt = new Date('2026-10-20T00:00:00Z');
    const now = new Date('2026-10-25T00:00:00Z');

    // When
    const result = calculateDaysLeft(endsAt, now, SEOUL);

    // Then max(10월 20일 - 10월 25일, 0) = 0일
    expect(result).toBe(0);
  });
});

describe('PremiumAccessPolicy', () => {
  describe('isGrantOnly', () => {
    it.each([
      ['GRANT', true],
      ['STORE', false],
      [null, false],
    ] as const)('출처가 %s면 %s를 반환한다', (source, expected) => {
      // Given
      const access = createPremiumAccess({ source });

      // When
      const result = PremiumAccessPolicy.isGrantOnly(access);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('hasBankedDays', () => {
    it.each([
      [0, false],
      [7, true],
    ])('쌓인 보상이 %i일이면 %s를 반환한다', (bankedDays, expected) => {
      // Given
      const access = createPremiumAccess({ source: 'STORE', bankedDays });

      // When
      const result = PremiumAccessPolicy.hasBankedDays(access);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('canSubscribeAfterGrant', () => {
    it.each([
      ['GRANT', true, true],
      ['GRANT', false, false],
      ['STORE', true, false],
      [null, true, false],
    ] as const)(
      '출처가 %s이고 스토어 설정이 %s면 %s를 반환한다',
      (source, isStoreConfigured, expected) => {
        // Given
        const access = createPremiumAccess({ source });

        // When
        const result = PremiumAccessPolicy.canSubscribeAfterGrant(access, isStoreConfigured);

        // Then
        expect(result).toBe(expected);
      },
    );
  });

  describe('daysLeft', () => {
    it('끝나는 시각이 없으면 null을 반환한다', () => {
      // Given
      const access = createPremiumAccess({ endsAt: null });

      // When
      const result = PremiumAccessPolicy.daysLeft(access, new Date('2026-10-25T00:00:00Z'), SEOUL);

      // Then
      expect(result).toBeNull();
    });

    it('끝나는 시각이 있으면 달력 일수를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.daysLeft(access, new Date('2026-10-25T03:00:00Z'), SEOUL);

      // Then 11월 1일 - 10월 25일 = 7일
      expect(result).toBe(7);
    });
  });

  describe('isEndingSoon', () => {
    it('자동 갱신되지 않고 내일 끝나면 true를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.isEndingSoon(
        access,
        new Date('2026-10-31T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBe(true);
    });

    it('이틀 남았으면 false를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.isEndingSoon(
        access,
        new Date('2026-10-30T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBe(false);
    });

    it('자동 갱신되면 내일 끝나도 false를 반환한다', () => {
      // Given
      const access = createPremiumAccess({ source: 'STORE', willRenew: true });

      // When
      const result = PremiumAccessPolicy.isEndingSoon(
        access,
        new Date('2026-10-31T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBe(false);
    });

    it('이미 끝났으면 false를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.isEndingSoon(
        access,
        new Date('2026-11-01T05:30:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isEndingToday', () => {
    it('끝나는 날 아침이면 true를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.isEndingToday(
        access,
        new Date('2026-10-31T23:00:00Z'), // 11월 1일 08:00 KST
        SEOUL,
      );

      // Then
      expect(result).toBe(true);
    });

    it('하루 전이면 false를 반환한다', () => {
      // Given
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.isEndingToday(
        access,
        new Date('2026-10-31T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBe(false);
    });
  });
});
