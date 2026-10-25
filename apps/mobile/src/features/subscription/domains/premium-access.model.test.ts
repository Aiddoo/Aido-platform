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

describe('calculateDaysLeft 달력 경계', () => {
  it.each([
    // 2028-03-12 02:00 PST → 03:00 PDT (23시간인 날)
    ['LA 서머타임 시작일을 지나', LOS_ANGELES, '2028-03-11T20:00:00Z', '2028-03-13T19:00:00Z', 2],
    // 2028-11-05 02:00 PDT → 01:00 PST (25시간인 날)
    ['LA 서머타임 종료일을 지나', LOS_ANGELES, '2028-11-04T19:00:00Z', '2028-11-06T20:00:00Z', 2],
    // 2028-02-29T15:00Z = 서울 3월 1일 00:00, LA 2월 29일 07:00
    [
      '서울에서 2월 28일 정오에 3월 1일 자정까지',
      SEOUL,
      '2028-02-28T03:00:00Z',
      '2028-02-29T15:00:00Z',
      2,
    ],
    [
      'LA에서 2월 28일 정오에 2월 29일 아침까지',
      LOS_ANGELES,
      '2028-02-28T20:00:00Z',
      '2028-02-29T15:00:00Z',
      1,
    ],
    [
      'LA에서 2월 29일 밤에 3월 1일까지',
      LOS_ANGELES,
      '2028-03-01T07:00:00Z',
      '2028-03-01T20:00:00Z',
      1,
    ],
  ] as const)('%s 남은 달력 일수를 반환한다', (_case, timeZone, now, endsAt, expected) => {
    // When
    const result = calculateDaysLeft(new Date(endsAt), new Date(now), timeZone);

    // Then
    expect(result).toBe(expected);
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

  describe('endingNotice', () => {
    it.each([
      ['내일 끝나면 tomorrow', '2026-10-31T01:00:00Z', 'tomorrow'],
      ['끝나는 날 아침이면 today', '2026-10-31T23:00:00Z', 'today'],
      ['끝나기 1ms 전이면 today', '2026-11-01T05:29:59.999Z', 'today'],
      ['끝나는 시각과 같으면 null', '2026-11-01T05:30:00.000Z', null],
      ['끝나고 1ms 뒤면 null', '2026-11-01T05:30:00.001Z', null],
      ['이틀 남았으면 null', '2026-10-30T01:00:00Z', null],
    ] as const)('자동 갱신 없이 %s을 반환한다', (_case, now, expected) => {
      // Given 11월 1일 14:30 KST에 끝나는 보상 기간
      const access = createPremiumAccess();

      // When
      const result = PremiumAccessPolicy.endingNotice(access, new Date(now), SEOUL);

      // Then
      expect(result).toBe(expected);
    });

    it('자동 갱신되면 내일 끝나도 null을 반환한다', () => {
      // Given
      const access = createPremiumAccess({ source: 'STORE', willRenew: true });

      // When
      const result = PremiumAccessPolicy.endingNotice(
        access,
        new Date('2026-10-31T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBeNull();
    });

    it('구독을 취소했어도 이어서 받을 보상이 남았으면 null을 반환한다', () => {
      // Given 스토어 구독이 내일 끝나지만 보상 7일이 이어진다
      const access = createPremiumAccess({ source: 'STORE', willRenew: false, bankedDays: 7 });

      // When
      const result = PremiumAccessPolicy.endingNotice(
        access,
        new Date('2026-10-31T01:00:00Z'),
        SEOUL,
      );

      // Then
      expect(result).toBeNull();
    });

    it.each([
      // 2028-02-29T15:00Z = 3월 1일 00:00 KST = 2월 29일 07:00 PST
      [SEOUL, '2028-02-29T14:00:00Z', 'tomorrow'],
      [LOS_ANGELES, '2028-02-29T14:00:00Z', 'today'],
    ] as const)(
      '윤년 2월 29일 경계에서 %s 기준 %s에는 %s를 반환한다',
      (timeZone, now, expected) => {
        // Given
        const access = createPremiumAccess({
          endsAt: new Date('2028-02-29T15:00:00Z'),
          periodEndsAt: new Date('2028-02-29T15:00:00Z'),
        });

        // When
        const result = PremiumAccessPolicy.endingNotice(access, new Date(now), timeZone);

        // Then
        expect(result).toBe(expected);
      },
    );
  });

  describe('purchaseSuccessMessage', () => {
    it.each([
      ['GRANT', 'purchaseSuccessWithReward'],
      ['STORE', 'purchaseSuccess'],
      [null, 'purchaseSuccess'],
    ] as const)('구매 전 출처가 %s면 %s를 반환한다', (source, expected) => {
      // Given
      const access = createPremiumAccess({ source });

      // When
      const result = PremiumAccessPolicy.purchaseSuccessMessage(access);

      // Then
      expect(result).toBe(expected);
    });

    it('내 정보를 아직 불러오지 않았으면 purchaseSuccess를 반환한다', () => {
      // When
      const result = PremiumAccessPolicy.purchaseSuccessMessage(undefined);

      // Then
      expect(result).toBe('purchaseSuccess');
    });
  });

  describe('restoreEmptyMessage', () => {
    it.each([
      ['GRANT', 'restoreEmptyWithReward'],
      ['STORE', 'restoreEmpty'],
      [null, 'restoreEmpty'],
    ] as const)('출처가 %s면 %s를 반환한다', (source, expected) => {
      // Given
      const access = createPremiumAccess({ source });

      // When
      const result = PremiumAccessPolicy.restoreEmptyMessage(access);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('hasChanged', () => {
    it('같은 시각을 새 Date로 받았으면 false를 반환한다', () => {
      // Given
      const previous = createPremiumAccess();
      const next = createPremiumAccess({ endsAt: new Date('2026-11-01T05:30:00Z') });

      // When
      const result = PremiumAccessPolicy.hasChanged(previous, next);

      // Then
      expect(result).toBe(false);
    });

    it.each([
      ['출처', { source: null }],
      ['전체 끝', { endsAt: new Date('2026-11-08T05:30:00Z') }],
      ['지금 기간의 끝', { periodEndsAt: new Date('2026-11-08T05:30:00Z') }],
      ['자동 갱신', { willRenew: true }],
      ['이어서 받을 보상', { bankedDays: 7 }],
    ] as const)('%s가 바뀌면 true를 반환한다', (_field, overrides) => {
      // Given
      const previous = createPremiumAccess();
      const next = createPremiumAccess(overrides);

      // When
      const result = PremiumAccessPolicy.hasChanged(previous, next);

      // Then
      expect(result).toBe(true);
    });
  });
});
