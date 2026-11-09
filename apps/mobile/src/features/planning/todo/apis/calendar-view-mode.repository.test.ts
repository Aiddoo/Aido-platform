import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';

import { createCalendarViewModeRepository } from './calendar-view-mode.repository';

describe('createCalendarViewModeRepository', () => {
  it.each([
    { saved: undefined, expected: 'week' },
    { saved: 'week', expected: 'week' },
    { saved: 'month', expected: 'month' },
    { saved: 'year', expected: 'week' },
  ])('저장값 $saved는 $expected로 읽는다', ({ saved, expected }) => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    if (saved != null) {
      storage.set('aido_calendar_view_mode', saved);
    }

    // When
    const result = createCalendarViewModeRepository(storage).get();

    // Then
    expect(result).toBe(expected);
  });
});
