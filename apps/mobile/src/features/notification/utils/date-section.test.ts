import { getDateSectionKey } from './date-section';

describe('getDateSectionKey', () => {
  test('이번 주는 달력과 같은 일요일 시작 주다', () => {
    // Given: 일요일 오늘, ISO 주(월요일 시작)로는 같은 주였던 지난 수요일
    const sundayDateKey = '2026-10-25';

    // When
    const section = getDateSectionKey('2026-10-21', sundayDateKey);

    // Then
    expect(section).toBe('thisMonth');
    expect(getDateSectionKey('2026-10-26', '2026-10-31')).toBe('thisWeek');
  });

  test('연말을 넘는 주와 어제를 날짜 key로 판단한다', () => {
    // Given: 2026-12-27(일)~2027-01-02(토) 주
    const newYearDateKey = '2027-01-01';

    // When / Then
    expect(getDateSectionKey('2026-12-31', newYearDateKey)).toBe('yesterday');
    expect(getDateSectionKey('2026-12-27', newYearDateKey)).toBe('thisWeek');
    expect(getDateSectionKey('2026-12-26', newYearDateKey)).toBe('earlier');
    expect(getDateSectionKey('2028-02-28', '2028-02-29')).toBe('yesterday');
  });
});
