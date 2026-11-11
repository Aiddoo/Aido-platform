import { customerInfoSchema } from '../domains/customer-info.model';
import { toCustomerInfo } from './customer-info.mapper';

describe('toCustomerInfo', () => {
  it('스토어가 알려 준 활성 구독을 모델로 바꾼다', () => {
    // Given
    const status = {
      activeEntitlements: [{ store: 'APP_STORE' as const, productIdentifier: 'aido.monthly' }],
    };

    // When
    const result = toCustomerInfo(status);

    // Then
    expect(customerInfoSchema.parse(result)).toEqual(status);
  });
});
