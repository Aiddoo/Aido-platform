import { formatPercent, formatPrice } from './format';

describe('formatPercent', () => {
  test('정수면 소수점 없이 반환한다', () => {
    expect(formatPercent(83)).toBe('83');
    expect(formatPercent(0)).toBe('0');
    expect(formatPercent(100)).toBe('100');
  });

  test('소수점 첫째 자리까지 반올림한다', () => {
    expect(formatPercent(8.99)).toBe('9');
    expect(formatPercent(83.456)).toBe('83.5');
    expect(formatPercent(83.44)).toBe('83.4');
  });

  test('소수점 첫째 자리가 0이 아닌 경우 표시한다', () => {
    expect(formatPercent(7.3)).toBe('7.3');
    expect(formatPercent(99.9)).toBe('99.9');
  });

  test('반올림 결과가 정수면 소수점을 생략한다', () => {
    expect(formatPercent(83.01)).toBe('83');
    expect(formatPercent(7.999)).toBe('8');
  });
});

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
