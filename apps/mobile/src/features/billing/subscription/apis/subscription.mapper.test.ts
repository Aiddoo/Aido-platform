import type { PurchaseOffering, PurchasePackage } from '@src/core/ports/purchases-gateway';

import { subscriptionOfferingSchema } from '../domains/subscription.model';
import { toSubscriptionOffering } from './subscription.mapper';

function createPurchasePackage(overrides?: Partial<PurchasePackage>): PurchasePackage {
  return {
    identifier: '$rc_monthly',
    packageType: 'MONTHLY',
    product: {
      priceString: '₩4,900',
      price: 4900,
      currencyCode: 'KRW',
      title: 'Aido 프리미엄',
      description: null,
      freeTrial: null,
    },
    ...overrides,
  };
}

describe('toSubscriptionOffering', () => {
  it('월간·연간 패키지를 요금제 모델로 바꾼다', () => {
    // Given
    const offering: PurchaseOffering = {
      identifier: 'default',
      packages: [
        createPurchasePackage(),
        createPurchasePackage({ identifier: '$rc_annual', packageType: 'ANNUAL' }),
      ],
    };

    // When
    const result = toSubscriptionOffering(offering);

    // Then
    expect(subscriptionOfferingSchema.parse(result)).toEqual(result);
    expect(result.plans.map((plan) => plan.planType)).toEqual(['monthly', 'annual']);
  });

  it.each([
    [
      '스토어 체험 기간을 요금제 체험으로 옮긴다',
      { periodUnit: 'WEEK', periodNumberOfUnits: 2 },
      { periodUnit: 'week', periodNumberOfUnits: 2 },
    ],
    ['체험 자격이 없으면 체험 없이 옮긴다', null, null],
  ] as const)('%s', (_case, freeTrial, expected) => {
    // Given
    const storePackage = createPurchasePackage({ identifier: '$rc_annual', packageType: 'ANNUAL' });
    const offering: PurchaseOffering = {
      identifier: 'default',
      packages: [{ ...storePackage, product: { ...storePackage.product, freeTrial } }],
    };

    // When
    const result = toSubscriptionOffering(offering);

    // Then
    expect(subscriptionOfferingSchema.parse(result)).toEqual(result);
    expect(result.plans[0]?.freeTrial).toEqual(expected);
  });

  it('월간·연간이 아닌 패키지는 요금제에서 뺀다', () => {
    // Given
    const offering: PurchaseOffering = {
      identifier: 'default',
      packages: [createPurchasePackage({ identifier: 'lifetime', packageType: 'OTHER' })],
    };

    // When
    const result = toSubscriptionOffering(offering);

    // Then
    expect(result.plans).toEqual([]);
  });
});
