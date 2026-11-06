import type { CustomerInfo } from '../schemas/customer-info.schema';
import { CustomerInfoPolicy } from './customer-info.model';

const createCustomerInfo = (
  activeEntitlements: CustomerInfo['activeEntitlements'] = [],
): CustomerInfo => ({ activeEntitlements });

describe('CustomerInfoPolicy.hasStoreEntitlement', () => {
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
    // When
    const result = CustomerInfoPolicy.hasStoreEntitlement(createCustomerInfo());

    // Then
    expect(result).toBe(false);
  });
});

describe('CustomerInfoPolicy.findStoreProductId', () => {
  it('그 스토어에서 결제한 활성 구독의 상품 id를 찾고, 없으면 null이다', () => {
    // Given
    const customerInfo = createCustomerInfo([
      { store: 'PROMOTIONAL', productIdentifier: 'rc_promo_premium' },
      { store: 'PLAY_STORE', productIdentifier: 'premium_monthly' },
    ]);

    // When
    const productIds = [
      CustomerInfoPolicy.findStoreProductId(customerInfo, 'PLAY_STORE'),
      CustomerInfoPolicy.findStoreProductId(customerInfo, 'APP_STORE'),
    ];

    // Then
    expect(productIds).toEqual(['premium_monthly', null]);
  });
});
