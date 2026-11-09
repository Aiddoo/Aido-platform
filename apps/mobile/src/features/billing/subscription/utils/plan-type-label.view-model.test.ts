import { createPremiumAccess } from '@src/features/identity/user/__tests__/premium-access.fixtures';

import { createEntitlementSnapshot } from '../__tests__/entitlement.fixtures';
import { toPlanTypeLabelKey } from './plan-type-label.view-model';

describe('toPlanTypeLabelKey', () => {
  it.each([
    ['연간 스토어 구독이면 연간', 'annual', 'plan.annual'],
    ['월간 스토어 구독이면 월간', 'monthly', 'plan.monthly'],
    ['구버전 서버라 요금제를 모르면 요금제 없이 구독', null, 'receipt.rows.planUnknown'],
  ] as const)('%s으로 보인다', (_case, planType, expected) => {
    // Given
    const access = createPremiumAccess({ source: 'STORE', planType });

    // When
    const key = toPlanTypeLabelKey(access, createEntitlementSnapshot({ tier: 'PREMIUM' }));

    // Then
    expect(key).toBe(expected);
  });

  it.each([
    ['초대 보상 기간이면 프리미엄', 'GRANT', 'PREMIUM', 'tier.premium'],
    ['구독이 없으면 무료', null, 'FREE', 'upsell.free'],
    ['관리자면 어드민', null, 'ADMIN', 'tier.admin'],
  ] as const)('스토어 구독이 아니고 %s으로 보인다', (_case, source, tier, expected) => {
    // Given
    const access = createPremiumAccess({ source, planType: null });

    // When
    const key = toPlanTypeLabelKey(access, createEntitlementSnapshot({ tier }));

    // Then
    expect(key).toBe(expected);
  });
});
