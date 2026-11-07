import {
  COUNT_BADGE_MAX,
  formatCappedCount,
  formatCompactCount,
  formatDecimal,
  formatPercent,
  formatPrice,
  formatFileSize,
} from './number-format';

describe('formatPercent', () => {
  it('정수면 소수점 없이 반환한다', () => {
    // When
    const results = [formatPercent(83), formatPercent(0), formatPercent(100)];

    // Then
    expect(results).toEqual(['83', '0', '100']);
  });

  it('소수점 첫째 자리까지 반올림한다', () => {
    // When
    const results = [formatPercent(8.99), formatPercent(83.456), formatPercent(83.44)];

    // Then
    expect(results).toEqual(['9', '83.5', '83.4']);
  });

  it('소수점 첫째 자리가 0이 아닌 경우 표시한다', () => {
    // When
    const results = [formatPercent(7.3), formatPercent(99.9)];

    // Then
    expect(results).toEqual(['7.3', '99.9']);
  });

  it('반올림 결과가 정수면 소수점을 생략한다', () => {
    // When
    const results = [formatPercent(83.01), formatPercent(7.999)];

    // Then
    expect(results).toEqual(['83', '8']);
  });
});

describe('formatPrice', () => {
  it('KRW는 소수점 없이 한국 로케일로 포맷한다', () => {
    // When
    const result = formatPrice(8_900, 'KRW');

    // Then
    expect(result).toContain('8,900');
    expect(result).toContain('₩');
  });

  it('USD는 소수점 2자리로 미국 로케일로 포맷한다', () => {
    // When
    const result = formatPrice(6.99, 'USD');

    // Then
    expect(result).toContain('6.99');
    expect(result).toContain('$');
    expect(result).not.toContain('US$');
  });

  it('JPY는 소수점 없이 일본 로케일로 포맷한다', () => {
    // When
    const result = formatPrice(1_200, 'JPY');

    // Then
    expect(result).toContain('1,200');
    expect(result).toContain('￥');
  });

  it('매핑되지 않은 통화도 en-US 폴백으로 포맷해 값을 반환한다', () => {
    // When
    const result = formatPrice(100, 'BRL');

    // Then
    expect(result).toBeDefined();
  });
});

describe('formatCappedCount', () => {
  it('상한 이하는 숫자 그대로 보여준다', () => {
    // When
    const results = [
      formatCappedCount(0),
      formatCappedCount(1),
      formatCappedCount(COUNT_BADGE_MAX),
    ];

    // Then
    expect(results).toEqual(['0', '1', '99']);
  });

  it('상한을 넘으면 접어서 폭이 더 늘지 않는다', () => {
    // When
    const justOver = formatCappedCount(COUNT_BADGE_MAX + 1);
    const large = formatCappedCount(1234);

    // Then
    expect(justOver).toBe('99+');
    expect(large).toBe('99+');
    expect(large.length).toBe(3);
  });

  it('상한은 자리마다 다르게 줄 수 있다', () => {
    // When
    const over = formatCappedCount(15, 9);
    const atMax = formatCappedCount(9, 9);

    // Then
    expect(over).toBe('9+');
    expect(atMax).toBe('9');
  });
});

describe('formatCompactCount', () => {
  it.each([
    [999, '999', '999'],
    [1_000, '1천', '1K'],
    [1_999, '1.9천', '1.9K'],
    [9_999, '9.9천', '9.9K'],
    [10_000, '1만', '10K'],
    [99_999, '9.9만', '99K'],
    [1_234_567, '123만', '1.2M'],
  ])('%i는 ko %s · en %s로 줄이고 반올림하지 않는다', (count, korean, english) => {
    // When
    const results = [formatCompactCount(count, 'ko'), formatCompactCount(count, 'en')];

    // Then
    expect(results).toEqual([korean, english]);
  });
});

describe('formatDecimal', () => {
  it('정한 자릿수까지 반올림하고 정수도 같은 자릿수로 맞춘다', () => {
    // When
    const rounded = formatDecimal(3.46, 'ko-KR');
    const integer = formatDecimal(3, 'en-US');

    // Then
    expect(rounded).toBe('3.5');
    expect(integer).toBe('3.0');
  });

  it('큰 수는 표시 언어의 자릿수 구분을 쓴다', () => {
    // When
    const result = formatDecimal(1234.56, 'en-US');

    // Then
    expect(result).toBe('1,234.6');
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0KB'],
    [1, '1KB'],
    [999_000, '999KB'],
    [2_500_000, '2.5MB'],
    [1_200_000_000, '1.2GB'],
  ])('%d바이트는 %s로 보인다', (bytes, expected) => {
    // Given
    const locale = 'ko-KR';

    // When
    const formatted = formatFileSize(bytes, locale);

    // Then
    expect(formatted).toBe(expected);
  });
});
