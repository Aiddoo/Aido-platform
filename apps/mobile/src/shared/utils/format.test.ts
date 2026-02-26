import { formatPrice } from './format';

describe('formatPrice', () => {
  test('KRW는 소수점 없이 포맷한다', () => {
    expect(formatPrice(8_900, 'KRW')).toContain('8,900');
  });

  test('USD는 소수점 2자리로 포맷한다', () => {
    expect(formatPrice(6.99, 'USD')).toContain('6.99');
  });

  test('JPY는 소수점 없이 포맷한다', () => {
    expect(formatPrice(1_200, 'JPY')).toContain('1,200');
  });
});
