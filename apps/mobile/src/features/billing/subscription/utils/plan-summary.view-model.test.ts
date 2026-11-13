import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { toInstant } from '@src/shared/date/instant';

import { toDisplayedUsedCount, toPlanSummary } from './plan-summary.view-model';
import { toSubscriptionReceiptViewModel } from './subscription-receipt.view-model';

// 2026년 11월 9일 12:00 KST
const NOW = toInstant('2026-11-09T03:00:00.000Z');

function createStoreSummary({
  periodEndsAt,
  willRenew,
}: {
  periodEndsAt: string;
  willRenew: boolean;
}) {
  const me = createCurrentUserDto({
    subscriptionStatus: 'ACTIVE',
    isPremium: true,
    premiumSource: 'STORE',
    premiumPeriodEndsAt: periodEndsAt,
    premiumEndsAt: periodEndsAt,
    willRenew,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
  });
  return toPlanSummary(
    toSubscriptionReceiptViewModel(toUser(me), {
      isStoreConfigured: true,
      now: NOW,
      timeZone: 'Asia/Seoul',
    }),
  );
}

describe('toPlanSummary', () => {
  it('결제 예정 시각이 지났는데 갱신이 아직 반영되지 않았으면 지난 날짜 대신 갱신 확인 중이다', () => {
    // Given
    const periodEndsAt = '2026-09-30T04:00:00.000Z';

    // When
    const summary = createStoreSummary({ periodEndsAt, willRenew: true });

    // Then
    expect(summary.period).toEqual({ type: 'renewalPending' });
  });

  it('자동 갱신을 끈 구독은 끝나는 날을 보인다', () => {
    // Given
    const periodEndsAt = '2026-11-20T04:00:00.000Z';

    // When
    const summary = createStoreSummary({ periodEndsAt, willRenew: false });

    // Then
    expect(summary.period).toEqual({ type: 'endsOn', date: toInstant(periodEndsAt) });
  });

  it('스토어 구독의 날짜는 해를 넘길 수 있어 영수증처럼 연도까지 보인다', () => {
    // Given
    // 연간 구독의 다음 결제일이 내년 9월 30일이라 월·일만 보이면 지난 날처럼 읽힌다
    const periodEndsAt = '2027-09-29T16:14:28.020Z';

    // When
    const summary = createStoreSummary({ periodEndsAt, willRenew: true });

    // Then
    expect(summary.period).toEqual({ type: 'nextBilling', date: toInstant(periodEndsAt) });
    expect(summary.dateLabel).toBe('fullDate');
  });
});

describe('toDisplayedUsedCount', () => {
  it.each([
    { title: '한도 안이면 쓴 횟수 그대로다', used: 3, limit: 10, expected: 3 },
    { title: '한도까지 쓰면 한도다', used: 10, limit: 10, expected: 10 },
    { title: '한도보다 많이 센 기록은 한도로 줄인다', used: 14, limit: 10, expected: 10 },
  ])('$title', ({ used, limit, expected }) => {
    // When
    const displayed = toDisplayedUsedCount(used, limit);

    // Then
    expect(displayed).toBe(expected);
  });
});
