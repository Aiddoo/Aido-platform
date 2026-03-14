import { createMockSyncStorage } from '@src/shared/__tests__';
import { readCalendarViewMode, writeCalendarViewMode } from './calendar-view-mode.preference';

describe('readCalendarViewMode', () => {
  it('저장된 값이 없으면 week를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readCalendarViewMode(storage);

    // Then
    expect(result).toBe('week');
  });

  it('week가 저장되어 있으면 week를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('week');

    // When
    const result = readCalendarViewMode(storage);

    // Then
    expect(result).toBe('week');
  });

  it('month가 저장되어 있으면 month를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('month');

    // When
    const result = readCalendarViewMode(storage);

    // Then
    expect(result).toBe('month');
  });

  it('유효하지 않은 값이 저장되어 있으면 week를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('day');

    // When
    const result = readCalendarViewMode(storage);

    // Then
    expect(result).toBe('week');
  });
});

describe('writeCalendarViewMode', () => {
  it('올바른 key와 value로 storage.set을 호출한다', () => {
    // Given
    const storage = createMockSyncStorage();

    // When
    writeCalendarViewMode(storage, 'month');

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_calendar_view_mode', 'month');
  });
});
