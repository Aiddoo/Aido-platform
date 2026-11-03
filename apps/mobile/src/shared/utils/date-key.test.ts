import { diffDateKeysInDays, getDayOfWeekOfDateKey } from './date-key';

describe('diffDateKeysInDays', () => {
  it.each([
    ['2028-02-28', '2028-03-01', 2],
    ['2026-03-07', '2026-03-09', 2],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-10-05', '2026-10-01', -4],
  ])('%s부터 %s까지는 %s일이다', (from, to, expected) => {
    // Given
    const range = { from, to };

    // When
    const days = diffDateKeysInDays(range.from, range.to);

    // Then
    expect(days).toBe(expected);
  });
});

describe('getDayOfWeekOfDateKey', () => {
  it.each([
    ['2028-02-29', 2],
    ['2026-11-01', 0],
    ['2026-10-31', 6],
  ])('%s의 요일 인덱스는 %s다', (dateKey, expected) => {
    // Given
    const key = dateKey;

    // When
    const weekday = getDayOfWeekOfDateKey(key);

    // Then
    expect(weekday).toBe(expected);
  });
});
