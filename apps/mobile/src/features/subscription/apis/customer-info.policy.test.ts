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
