import { toInstant } from '@src/shared/date/instant';

import { createPremiumAccess, PREMIUM_ME_EXAMPLES } from '../__tests__/premium-access.fixtures';
import { toUser } from '../apis/user.mapper';
import { PremiumAccessPolicy } from './premium-access.model';

const SEOUL = 'Asia/Seoul';
const LOS_ANGELES = 'America/Los_Angeles';

describe('isStoreSubscribed', () => {
  it.each([
    ['STORE', true],
    ['GRANT', false],
    [null, false],
  ] as const)('출처가 %s면 %s를 반환한다', (source, expected) => {
    // Given
    // 보상 프리미엄만 쓰는 중(GRANT)이거나 프리미엄이 없으면 구독을 권할 수 있다
    const access = createPremiumAccess({ source });

    // When
    const result = PremiumAccessPolicy.isStoreSubscribed(access);

    // Then
    expect(result).toBe(expected);
  });
});

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

describe('getDaysLeft', () => {
  it('끝나는 시각이 없으면 null을 반환한다', () => {
    // Given
    const access = createPremiumAccess({ endsAt: null });

    // When
    const result = PremiumAccessPolicy.getDaysLeft(
      access,
      toInstant('2026-10-25T00:00:00Z'),
      SEOUL,
    );

    // Then
    expect(result).toBeNull();
  });

  it('끝나는 시각이 있으면 달력 일수를 반환한다', () => {
    // Given
    const access = createPremiumAccess();

    // When
    const result = PremiumAccessPolicy.getDaysLeft(
      access,
      toInstant('2026-10-25T03:00:00Z'),
      SEOUL,
    );

    // Then
    // 11월 1일 - 10월 25일 = 7일
    expect(result).toBe(7);
  });

  it.each([
    // 2028-02-29T15:00Z = 3월 1일 00:00 KST = 2월 29일 07:00 PST
    [SEOUL, '2028-02-29T14:00:00Z', 1],
    [LOS_ANGELES, '2028-02-29T14:00:00Z', 0],
  ] as const)(
    '윤년 2월 29일 경계에서 %s 기준 %s에는 남은 일수 %i를 반환한다',
    (timeZone, now, expected) => {
      // Given
      const access = createPremiumAccess({
        endsAt: toInstant('2028-02-29T15:00:00Z'),
        periodEndsAt: toInstant('2028-02-29T15:00:00Z'),
      });

      // When
      const result = PremiumAccessPolicy.getDaysLeft(access, toInstant(now), timeZone);

      // Then
      expect(result).toBe(expected);
    },
  );
});

describe('isExpiringSoon', () => {
  it.each([
    ['내일 끝나면 true', '2026-10-31T01:00:00Z', true],
    ['끝나는 날 아침이면 true', '2026-10-31T23:00:00Z', true],
    ['끝나기 1ms 전이면 true', '2026-11-01T05:29:59.999Z', true],
    ['끝나는 시각과 같으면 false', '2026-11-01T05:30:00.000Z', false],
    ['끝나고 1ms 뒤면 false', '2026-11-01T05:30:00.001Z', false],
    ['이틀 남았으면 false', '2026-10-30T01:00:00Z', false],
  ] as const)('자동 갱신 없이 %s를 반환한다', (_case, now, expected) => {
    // Given
    // 11월 1일 14:30 KST에 끝나는 보상 기간
    const access = createPremiumAccess();

    // When
    const result = PremiumAccessPolicy.isExpiringSoon(access, toInstant(now), SEOUL);

    // Then
    expect(result).toBe(expected);
  });

  it('끝나는 시각이 없으면 false를 반환한다', () => {
    // Given
    const access = createPremiumAccess({ source: null, endsAt: null, periodEndsAt: null });

    // When
    const result = PremiumAccessPolicy.isExpiringSoon(
      access,
      toInstant('2026-10-31T01:00:00Z'),
      SEOUL,
    );

    // Then
    expect(result).toBe(false);
  });

  it('자동 갱신되면 내일 끝나도 false를 반환한다', () => {
    // Given
    const access = createPremiumAccess({ source: 'STORE', willRenew: true });

    // When
    const result = PremiumAccessPolicy.isExpiringSoon(
      access,
      toInstant('2026-10-31T01:00:00Z'),
      SEOUL,
    );

    // Then
    expect(result).toBe(false);
  });

  it('구독을 취소했어도 이어서 받을 보상이 남았으면 false를 반환한다', () => {
    // Given
    // 스토어 구독이 내일 끝나지만 보상 7일이 이어진다
    const access = createPremiumAccess({ source: 'STORE', willRenew: false, bankedDays: 7 });

    // When
    const result = PremiumAccessPolicy.isExpiringSoon(
      access,
      toInstant('2026-10-31T01:00:00Z'),
      SEOUL,
    );

    // Then
    expect(result).toBe(false);
  });
});

describe('hasChanged', () => {
  it('같은 시각을 새 Date로 받았으면 false를 반환한다', () => {
    // Given
    const previous = createPremiumAccess();
    const next = createPremiumAccess({ endsAt: toInstant('2026-11-01T05:30:00Z') });

    // When
    const result = PremiumAccessPolicy.hasChanged(previous, next);

    // Then
    expect(result).toBe(false);
  });

  it.each([
    ['출처', { source: null }],
    ['전체 끝', { endsAt: toInstant('2026-11-08T05:30:00Z') }],
    ['지금 기간의 끝', { periodEndsAt: toInstant('2026-11-08T05:30:00Z') }],
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

describe('hasEndedSince', () => {
  // 기본 보상 기간은 11월 1일 14:30 KST(05:30Z)에 끝난다
  it.each([
    ['끝나기 1분 전이면 false다', '2026-11-01T05:28:00Z', '2026-11-01T05:29:00Z', false],
    ['끝나는 시각에 닿으면 true다', '2026-11-01T05:29:00Z', '2026-11-01T05:30:00Z', true],
    ['끝나고 1분 뒤 처음 확인하면 true다', '2026-11-01T05:29:00Z', '2026-11-01T05:31:00Z', true],
    ['이미 확인한 끝은 다시 알리지 않는다', '2026-11-01T05:31:00Z', '2026-11-01T05:32:00Z', false],
    [
      '백그라운드에 있는 동안 끝나고 돌아오면 true다',
      '2026-10-31T10:00:00Z',
      '2026-11-02T01:00:00Z',
      true,
    ],
  ] as const)('%s', (_name, lastCheckedAt, now, expected) => {
    // Given
    const access = createPremiumAccess();

    // When
    const result = PremiumAccessPolicy.hasEndedSince(
      access,
      toInstant(lastCheckedAt),
      toInstant(now),
    );

    // Then
    expect(result).toBe(expected);
  });

  it('쌓아 둔 보상이 남아도 지금 기간이 끝나면 true다', () => {
    // Given
    // 지금 보상은 11월 1일에 끝나고 이어서 받을 7일이 있다
    const access = createPremiumAccess({
      endsAt: toInstant('2026-11-08T05:30:00Z'),
      bankedDays: 7,
    });

    // When
    const result = PremiumAccessPolicy.hasEndedSince(
      access,
      toInstant('2026-11-01T05:29:00Z'),
      toInstant('2026-11-01T05:31:00Z'),
    );

    // Then
    expect(result).toBe(true);
  });

  it('프리미엄이 아니라 끝나는 시각이 없으면 false다', () => {
    // Given
    const access = createPremiumAccess({ source: null, endsAt: null, periodEndsAt: null });

    // When
    const result = PremiumAccessPolicy.hasEndedSince(
      access,
      toInstant('2026-10-01T00:00:00Z'),
      toInstant('2026-12-01T00:00:00Z'),
    );

    // Then
    expect(result).toBe(false);
  });

  it('끝났다고 판단하는 순간 남은 기간 안내도 사라져 표시와 경계가 같다', () => {
    // Given
    const access = createPremiumAccess();
    const justBefore = toInstant('2026-11-01T05:29:00Z');
    const atEnd = toInstant('2026-11-01T05:30:00Z');

    // When
    const hasEnded = PremiumAccessPolicy.hasEndedSince(access, justBefore, atEnd);

    // Then
    expect(hasEnded).toBe(true);
    expect(PremiumAccessPolicy.isExpiringSoon(access, justBefore, SEOUL)).toBe(true);
    expect(PremiumAccessPolicy.isExpiringSoon(access, atEnd, SEOUL)).toBe(false);
  });
});

describe('getRecentGrantEndedAt', () => {
  it('보상이 끝나 무료로 돌아왔으면 서버가 준 끝난 시각을 반환한다', () => {
    // Given
    const { premiumAccess } = toUser(PREMIUM_ME_EXAMPLES.endedReward);

    // When
    const result = PremiumAccessPolicy.getRecentGrantEndedAt(premiumAccess);

    // Then
    expect(result).toEqual(toInstant('2028-03-04T04:00:00.000Z'));
  });

  it('다시 프리미엄이면 지난 보상이 끝난 것을 알리지 않는다', () => {
    // Given
    // 끝난 시각이 남아 있어도 지금은 보상 기간이다
    const premiumAccess = createPremiumAccess({
      source: 'GRANT',
      grantEndedAt: toInstant('2028-03-04T04:00:00.000Z'),
    });

    // When
    const result = PremiumAccessPolicy.getRecentGrantEndedAt(premiumAccess);

    // Then
    expect(result).toBeNull();
  });
});

describe('isTrial', () => {
  it.each([
    ['스토어 구독이 체험이면 true', 'STORE', true, true],
    ['스토어 구독이 결제 중이면 false', 'STORE', false, false],
    ['보상 기간이면 체험 값이 섞여도 false', 'GRANT', true, false],
  ] as const)('%s를 반환한다', (_case, source, isTrial, expected) => {
    // Given
    const access = createPremiumAccess({ source, isTrial });

    // When
    const result = PremiumAccessPolicy.isTrial(access);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isTrialEndingSoon', () => {
  // 11월 1일 14:30 KST에 끝나는 체험
  const trial = createPremiumAccess({ source: 'STORE', isTrial: true, willRenew: true });

  it.each([
    ['4일 남았으면 false', '2026-10-28T01:00:00Z', false],
    ['3일 남았으면 true', '2026-10-29T01:00:00Z', true],
    ['끝나는 날 아침이면 true', '2026-10-31T23:00:00Z', true],
    ['끝나는 시각이 지났으면 false', '2026-11-01T05:30:00.000Z', false],
  ] as const)('자동 갱신과 상관없이 %s를 반환한다', (_case, now, expected) => {
    // When
    const result = PremiumAccessPolicy.isTrialEndingSoon(trial, toInstant(now), SEOUL);

    // Then
    expect(result).toBe(expected);
  });

  it('남은 날은 기기 시간대의 달력 날짜로 센다', () => {
    // Given
    // LA로는 10월 28일 22:00, 끝나는 10월 31일 22:30까지 달력 3일
    const now = toInstant('2026-10-29T05:00:00Z');

    // When
    const daysLeft = PremiumAccessPolicy.getTrialDaysLeft(trial, now, LOS_ANGELES);

    // Then
    expect(daysLeft).toBe(3);
  });

  it('체험이 아니면 남은 날이 없다', () => {
    // When
    const daysLeft = PremiumAccessPolicy.getTrialDaysLeft(
      createPremiumAccess(),
      toInstant('2026-10-31T01:00:00Z'),
      SEOUL,
    );

    // Then
    expect(daysLeft).toBeNull();
  });
});

describe('getBankedRewardStartsAt', () => {
  const PERIOD_ENDS_AT = toInstant('2026-12-09T00:00:00.000Z');

  it('해지한 구독 뒤에 보상이 있으면 구독이 끝나는 순간부터 이어진다', () => {
    // Given
    const access = createPremiumAccess({
      source: 'STORE',
      willRenew: false,
      bankedDays: 14,
      periodEndsAt: PERIOD_ENDS_AT,
    });

    // When
    const startsAt = PremiumAccessPolicy.getBankedRewardStartsAt(access);

    // Then
    expect(startsAt).toBe(PERIOD_ENDS_AT);
  });

  it.each([
    ['자동 갱신 중이면 구독 끝이 정해지지 않아', { willRenew: true, bankedDays: 14 }],
    ['이어서 받을 보상이 없으면', { willRenew: false, bankedDays: 0 }],
  ] as const)('%s 시작일이 없다', (_case, overrides) => {
    // Given
    const access = createPremiumAccess({
      source: 'STORE',
      periodEndsAt: PERIOD_ENDS_AT,
      ...overrides,
    });

    // When
    const startsAt = PremiumAccessPolicy.getBankedRewardStartsAt(access);

    // Then
    expect(startsAt).toBeNull();
  });
});

describe('isRenewalPending', () => {
  const PERIOD_ENDS_AT = toInstant('2026-12-09T00:00:00.000Z');

  it('자동 갱신 중인데 기간 끝이 지났으면 갱신 확인을 기다리는 중이다', () => {
    // Given
    const access = createPremiumAccess({ willRenew: true, periodEndsAt: PERIOD_ENDS_AT });

    // When
    const isPending = PremiumAccessPolicy.isRenewalPending(
      access,
      toInstant('2026-12-09T00:00:01.000Z'),
    );

    // Then
    expect(isPending).toBe(true);
  });

  it('끝나는 시각 자체부터 갱신 확인 중으로 본다', () => {
    // Given
    const access = createPremiumAccess({ willRenew: true, periodEndsAt: PERIOD_ENDS_AT });

    // When
    const isPending = PremiumAccessPolicy.isRenewalPending(access, PERIOD_ENDS_AT);

    // Then
    expect(isPending).toBe(true);
  });

  it.each([
    [
      '기간 끝이 아직 오지 않았으면',
      { willRenew: true, periodEndsAt: PERIOD_ENDS_AT },
      '2026-12-08T23:59:59.000Z',
    ],
    [
      '자동 갱신을 껐으면',
      { willRenew: false, periodEndsAt: PERIOD_ENDS_AT },
      '2026-12-09T00:00:01.000Z',
    ],
    ['기간 끝을 모르면', { willRenew: true, periodEndsAt: null }, '2026-12-09T00:00:01.000Z'],
  ] as const)('%s 갱신 확인 중이 아니다', (_case, overrides, now) => {
    // Given
    const access = createPremiumAccess(overrides);

    // When
    const isPending = PremiumAccessPolicy.isRenewalPending(access, toInstant(now));

    // Then
    expect(isPending).toBe(false);
  });
});
