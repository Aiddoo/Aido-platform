import { formatPrice } from './format';

describe('formatPrice', () => {
  test('KRW는 소수점 없이 한국 로케일로 포맷한다', () => {
    const result = formatPrice(8_900, 'KRW');
    expect(result).toContain('8,900');
    expect(result).toContain('₩');
  });

  test('USD는 소수점 2자리로 미국 로케일로 포맷한다', () => {
    const result = formatPrice(6.99, 'USD');
    expect(result).toContain('6.99');
    expect(result).toContain('$');
    expect(result).not.toContain('US$');
  });

  test('JPY는 소수점 없이 일본 로케일로 포맷한다', () => {
    const result = formatPrice(1_200, 'JPY');
    expect(result).toContain('1,200');
    expect(result).toContain('￥');
  });

  test('매핑되지 않은 통화는 en-US 폴백으로 포맷한다', () => {
    const result = formatPrice(100, 'BRL');
    expect(result).toBeDefined();
  });
});
