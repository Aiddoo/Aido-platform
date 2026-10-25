import { CustomerInfoPolicy } from './customer-info.policy';

describe('CustomerInfoPolicy.hasStoreEntitlement', () => {
  it('스토어에서 결제한 엔타이틀먼트가 있으면 true를 반환한다', () => {
    // Given
    const entitlements = { active: { premium: { store: 'APP_STORE' as const } } };

    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(entitlements);

    // Then
    expect(result).toBe(true);
  });

  it('보상으로 받은 엔타이틀먼트만 있으면 복원할 구매가 없다고 본다', () => {
    // Given
    const entitlements = { active: { premium: { store: 'PROMOTIONAL' as const } } };

    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(entitlements);

    // Then
    expect(result).toBe(false);
  });

  it('활성 엔타이틀먼트가 없으면 false를 반환한다', () => {
    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement({ active: {} });

    // Then
    expect(result).toBe(false);
  });
});

describe('CustomerInfoPolicy.findStoreProductId', () => {
  it('그 스토어에서 결제한 활성 구독의 상품 id를 찾고, 없으면 null이다', () => {
    const entitlements = {
      active: {
        promo: { store: 'PROMOTIONAL' as const, productIdentifier: 'rc_promo_premium' },
        premium: { store: 'PLAY_STORE' as const, productIdentifier: 'premium_monthly' },
      },
    };

    expect(CustomerInfoPolicy.findStoreProductId(entitlements, 'PLAY_STORE')).toBe(
      'premium_monthly',
    );
    expect(CustomerInfoPolicy.findStoreProductId(entitlements, 'APP_STORE')).toBeNull();
  });
});
