import { parseCalendarViewMode } from './calendar-view-mode.schema';

describe('parseCalendarViewMode', () => {
  it.each([
    { saved: undefined, expected: 'week' },
    { saved: 'week', expected: 'week' },
    { saved: 'month', expected: 'month' },
    { saved: 'year', expected: 'week' },
  ])('저장값 $saved는 $expected로 읽는다', ({ saved, expected }) => {
    // Given
    const stored = saved;

    // When
    const result = parseCalendarViewMode(stored);

    // Then
    expect(result).toBe(expected);
  });
});
