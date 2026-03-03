import { getDayOfWeekFromDate } from './day-of-week';

describe('getDayOfWeekFromDate', () => {
  it('월요일 Date를 넘기면 MON을 반환해야 한다', () => {
    // Given
    const monday = new Date('2025-03-17');

    // When
    const result = getDayOfWeekFromDate(monday);

    // Then
    expect(result).toBe('MON');
  });

  it('화요일 Date를 넘기면 TUE를 반환해야 한다', () => {
    // Given
    const tuesday = new Date('2025-03-18');

    // When
    const result = getDayOfWeekFromDate(tuesday);

    // Then
    expect(result).toBe('TUE');
  });

  it('수요일 Date를 넘기면 WED를 반환해야 한다', () => {
    // Given
    const wednesday = new Date('2025-03-19');

    // When
    const result = getDayOfWeekFromDate(wednesday);

    // Then
    expect(result).toBe('WED');
  });

  it('목요일 Date를 넘기면 THU를 반환해야 한다', () => {
    // Given
    const thursday = new Date('2025-03-20');

    // When
    const result = getDayOfWeekFromDate(thursday);

    // Then
    expect(result).toBe('THU');
  });

  it('금요일 Date를 넘기면 FRI를 반환해야 한다', () => {
    // Given
    const friday = new Date('2025-03-21');

    // When
    const result = getDayOfWeekFromDate(friday);

    // Then
    expect(result).toBe('FRI');
  });

  it('토요일 Date를 넘기면 SAT를 반환해야 한다', () => {
    // Given
    const saturday = new Date('2025-03-22');

    // When
    const result = getDayOfWeekFromDate(saturday);

    // Then
    expect(result).toBe('SAT');
  });

  it('일요일 Date를 넘기면 SUN을 반환해야 한다', () => {
    // Given
    const sunday = new Date('2025-03-23');

    // When
    const result = getDayOfWeekFromDate(sunday);

    // Then
    expect(result).toBe('SUN');
  });
});
