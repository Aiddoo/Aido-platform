import { type SubscriptionOffering, type SubscriptionPlan } from './subscription.model';
import { SubscriptionPolicy } from './subscription.model';

function createPlan(overrides: Partial<SubscriptionPlan>): SubscriptionPlan {
  return {
    identifier: 'monthly',
    planType: 'monthly',
    priceString: '₩8,900',
    price: 8_900,
    currencyCode: 'KRW',
    title: '월간',
    description: null,
    freeTrial: null,
    ...overrides,
  };
}

const monthly = createPlan({ identifier: 'monthly', planType: 'monthly' });
const annual = createPlan({ identifier: 'annual', planType: 'annual' });
const offering: SubscriptionOffering = { identifier: 'default', plans: [monthly, annual] };

describe('findSelectedPlan', () => {
  it('고르지 않았으면 연간을 고른 것으로 본다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, undefined);

    // Then
    expect(plan).toBe(annual);
  });

  it('연간이 없으면 첫 요금제를 고른 것으로 본다', () => {
    // Given
    const monthlyOnly = { ...offering, plans: [monthly] };

    // When
    const plan = SubscriptionPolicy.findSelectedPlan(monthlyOnly, undefined);

    // Then
    expect(plan).toBe(monthly);
  });

  it('고른 요금제가 있으면 그것을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, 'monthly');

    // Then
    expect(plan).toBe(monthly);
  });

  it('고른 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findSelectedPlan(offering, 'old-plan');

    // Then
    expect(plan).toBeNull();
  });
});

describe('findPlanByType', () => {
  it.each(['monthly', 'annual'] as const)('%s 요금제를 찾아 반환한다', (planType) => {
    // When
    const plan = SubscriptionPolicy.findPlanByType(offering.plans, planType);

    // Then
    expect(plan?.planType).toBe(planType);
  });

  it('그 종류의 요금제가 판매에서 빠졌으면 없는 값을 반환한다', () => {
    // When
    const plan = SubscriptionPolicy.findPlanByType([monthly], 'annual');

    // Then
    expect(plan).toBeNull();
  });
});

describe('getAnnualDiscountPercent', () => {
  it.each([
    [8_900, 68_000, 36],
    [1_000, 12_000, 0],
  ])('월 %i원, 연 %i원의 할인율은 %i%%이다', (monthlyPrice, annualPrice, expected) => {
    // When
    const percent = SubscriptionPolicy.getAnnualDiscountPercent(
      { price: monthlyPrice },
      { price: annualPrice },
    );

    // Then
    expect(percent).toBe(expected);
  });
});

describe('getMonthlyEquivalent', () => {
  it.each([
    [68_000, 5666.67],
    [12_000, 1_000],
    [59.88, 4.99],
    [0.06, 0.01],
    [8.89, 0.74],
  ])('연 %f원의 월 환산 금액은 %f원이다', (annualPrice, expected) => {
    // When
    const monthlyEquivalent = SubscriptionPolicy.getMonthlyEquivalent({ price: annualPrice });

    // Then
    expect(monthlyEquivalent).toBeCloseTo(expected, 2);
  });
});

describe('getFreeTrialEndDateKey', () => {
  it.each([
    ['1개월 체험은 다음 달 같은 날에 끝난다', 'month', 1, '2026-11-09', '2026-12-09'],
    [
      '1월 31일에 시작한 1개월 체험은 평년 2월 말일에 끝난다',
      'month',
      1,
      '2027-01-31',
      '2027-02-28',
    ],
    [
      '윤년 1월 31일에 시작한 1개월 체험은 2월 29일에 끝난다',
      'month',
      1,
      '2028-01-31',
      '2028-02-29',
    ],
    [
      '윤년 2월 29일에 시작한 1년 체험은 다음 해 2월 28일에 끝난다',
      'year',
      1,
      '2028-02-29',
      '2029-02-28',
    ],
    ['7일 체험은 해를 넘겨 센다', 'day', 7, '2026-12-28', '2027-01-04'],
    ['2주 체험은 14일 뒤에 끝난다', 'week', 2, '2026-11-09', '2026-11-23'],
  ] as const)('%s', (_case, periodUnit, periodNumberOfUnits, todayKey, expected) => {
    // Given
    const plan = createPlan({ planType: 'annual', freeTrial: { periodUnit, periodNumberOfUnits } });

    // When
    const endDateKey = SubscriptionPolicy.getFreeTrialEndDateKey(plan, todayKey);

    // Then
    expect(endDateKey).toBe(expected);
  });

  it('체험 자격이 없으면 끝나는 날이 없다', () => {
    // When
    const endDateKey = SubscriptionPolicy.getFreeTrialEndDateKey(annual, '2026-11-09');

    // Then
    expect(endDateKey).toBeNull();
  });
});

describe('getFreeTrialReminderDateKey', () => {
  it('체험이 끝나기 3일 전을 알림 날로 반환한다', () => {
    // Given
    const plan = createPlan({ freeTrial: { periodUnit: 'month', periodNumberOfUnits: 1 } });

    // When
    const reminderDateKey = SubscriptionPolicy.getFreeTrialReminderDateKey(plan, '2028-02-01');

    // Then
    // 윤년 3월 1일에 끝나므로 2월 27일
    expect(reminderDateKey).toBe('2028-02-27');
  });

  it.each([
    ['3일 체험이면 알림 날이 오늘이라', 3],
    ['하루 체험이면 알림 날이 지나', 1],
  ] as const)('%s 알림이 없다', (_case, days) => {
    // Given
    const plan = createPlan({ freeTrial: { periodUnit: 'day', periodNumberOfUnits: days } });

    // When
    const reminderDateKey = SubscriptionPolicy.getFreeTrialReminderDateKey(plan, '2026-11-09');

    // Then
    expect(reminderDateKey).toBeNull();
  });
});

describe('hasFreeTrial', () => {
  it.each([
    [
      '스토어가 체험을 줄 수 있다고 했으면 true',
      { periodUnit: 'month', periodNumberOfUnits: 1 },
      true,
    ],
    ['자격이 없으면 false', null, false],
  ] as const)('%s를 반환한다', (_case, freeTrial, expected) => {
    // When
    const result = SubscriptionPolicy.hasFreeTrial(createPlan({ freeTrial }));

    // Then
    expect(result).toBe(expected);
  });
});
