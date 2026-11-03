import { diffDateKeysInDays, getDayOfWeekOfDateKey } from './date-key';

describe('diffDateKeysInDays — 두 날짜 key 사이의 달력 일수', () => {
  it.each([
    ['2028-02-28', '2028-03-01', 2],
    ['2026-03-07', '2026-03-09', 2],
    ['2026-12-31', '2027-01-01', 1],
    ['2026-10-05', '2026-10-01', -4],
  ])('%s부터 %s까지는 %s일이다', (from, to, expected) => {
    // When
    const days = diffDateKeysInDays(from, to);

    // Then
    expect(days).toBe(expected);
  });
});

describe('getDayOfWeekOfDateKey — 날짜 key의 요일', () => {
  it.each([
    ['2028-02-29', 2],
    ['2026-11-01', 0],
    ['2026-10-31', 6],
  ])('%s의 요일 인덱스는 %s다', (dateKey, expected) => {
    // When
    const weekday = getDayOfWeekOfDateKey(dateKey);

    // Then
    expect(weekday).toBe(expected);
  });
});
