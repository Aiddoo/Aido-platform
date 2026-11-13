import { type CustomerInfo } from './customer-info.model';
import { CustomerInfoPolicy } from './customer-info.model';

function createCustomerInfo(
  activeEntitlements: CustomerInfo['activeEntitlements'] = [],
): CustomerInfo {
  return { activeEntitlements, managementUrl: null };
}

describe('hasStoreEntitlement', () => {
  it('스토어에서 결제한 엔타이틀먼트가 있으면 true를 반환한다', () => {
    // Given
    const customerInfo = createCustomerInfo([
      { store: 'APP_STORE', productIdentifier: 'premium_monthly' },
    ]);

    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(customerInfo);

    // Then
    expect(result).toBe(true);
  });

  it('보상으로 받은 엔타이틀먼트만 있으면 복원할 구매가 없다고 본다', () => {
    // Given
    const customerInfo = createCustomerInfo([
      { store: 'PROMOTIONAL', productIdentifier: 'rc_promo_premium' },
    ]);

    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(customerInfo);

    // Then
    expect(result).toBe(false);
  });

  it('활성 엔타이틀먼트가 없으면 false를 반환한다', () => {
    // Given
    const customerInfo = createCustomerInfo();

    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(customerInfo);

    // Then
    expect(result).toBe(false);
  });
});

describe('findStoreProductId', () => {
  it('그 스토어에서 결제한 활성 구독의 상품 id를 반환한다', () => {
    // Given
    const customerInfo = createCustomerInfo([
      { store: 'PROMOTIONAL', productIdentifier: 'rc_promo_premium' },
      { store: 'PLAY_STORE', productIdentifier: 'premium_monthly' },
    ]);

    // When
    const productId = CustomerInfoPolicy.findStoreProductId(customerInfo, 'PLAY_STORE');

    // Then
    expect(productId).toBe('premium_monthly');
  });

  it('다른 스토어에서 결제한 구독뿐이면 null을 반환한다', () => {
    // Given
    const customerInfo = createCustomerInfo([
      { store: 'PLAY_STORE', productIdentifier: 'premium_monthly' },
    ]);

    // When
    const productId = CustomerInfoPolicy.findStoreProductId(customerInfo, 'APP_STORE');

    // Then
    expect(productId).toBeNull();
  });
});
