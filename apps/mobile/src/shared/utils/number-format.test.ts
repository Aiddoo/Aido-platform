import {
  COUNT_BADGE_MAX,
  formatCappedCount,
  formatCompactCount,
  formatDecimal,
  formatPercent,
  formatFileSize,
} from './number-format';

describe('formatPercent', () => {
  it.each([
    { value: 83, ko: '83%', en: '83%' },
    { value: 0, ko: '0%', en: '0%' },
    { value: 100, ko: '100%', en: '100%' },
    { value: 8.99, ko: '9%', en: '9%' },
    { value: 83.456, ko: '83.5%', en: '83.5%' },
    { value: 83.44, ko: '83.4%', en: '83.4%' },
    { value: 83.45, ko: '83.5%', en: '83.5%' },
    { value: 83.01, ko: '83%', en: '83%' },
    { value: 7.999, ko: '8%', en: '8%' },
  ])('$value는 소수 첫째 자리까지 반올림해 %를 붙인다', ({ value, ko, en }) => {
    // When
    const results = [formatPercent(value, 'ko-KR'), formatPercent(value, 'en-US')];

    // Then
    expect(results).toEqual([ko, en]);
  });

  it.each([
    { value: 2.5, expected: '+2.5%' },
    { value: -2.5, expected: '-2.5%' },
    { value: 0, expected: '0%' },
    { value: -0.04, expected: '0%' },
  ])('변화량 $value는 0이 아닐 때만 부호를 붙인다', ({ value, expected }) => {
    // When
    const results = [
      formatPercent(value, 'ko-KR', { signDisplay: 'exceptZero' }),
      formatPercent(value, 'en-US', { signDisplay: 'exceptZero' }),
    ];

    // Then
    expect(results).toEqual([expected, expected]);
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
    expect(large).toHaveLength(3);
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
    [0, '0\u00A0KB'],
    [1, '1\u00A0KB'],
    [999_000, '999\u00A0KB'],
    [2_500_000, '2.5\u00A0MB'],
    [1_200_000_000, '1.2\u00A0GB'],
  ])('%d바이트는 숫자와 단위 사이를 줄바꿈 없는 공백으로 띄워 %s로 보인다', (bytes, expected) => {
    // Given
    const locale = 'ko-KR';

    // When
    const formatted = formatFileSize(bytes, locale);

    // Then
    expect(formatted).toBe(expected);
  });
});
