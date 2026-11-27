import {
  type TodoImportFeedEntry,
  TodoImportFeedEntryPolicy,
} from './todo-import-feed-entry.model';

describe('TodoImportFeedEntryPolicy', () => {
  describe('canOffer', () => {
    const cases: { scenario: string; entry: TodoImportFeedEntry; expected: boolean }[] = [
      {
        scenario: '권한을 아직 묻지 않았으면 권할 수 있다',
        entry: { isDismissed: false, calendarAccess: 'ask' },
        expected: true,
      },
      {
        scenario: '이미 허용했으면 권할 수 있다',
        entry: { isDismissed: false, calendarAccess: 'granted' },
        expected: true,
      },
      {
        scenario: '닫았으면 다시 권하지 않는다',
        entry: { isDismissed: true, calendarAccess: 'ask' },
        expected: false,
      },
      {
        scenario: '설정에서만 켤 수 있게 거절했으면 권하지 않는다',
        entry: { isDismissed: false, calendarAccess: 'settings' },
        expected: false,
      },
    ];

    it.each(cases)('$scenario', ({ entry, expected }) => {
      // When
      const canOffer = TodoImportFeedEntryPolicy.canOffer(entry);

      // Then
      expect(canOffer).toBe(expected);
    });
  });

  describe('shouldShow', () => {
    it.each([
      { scenario: '할 일이 하나도 없으면 권한다', hasTodo: false, expected: true },
      { scenario: '할 일이 하나라도 있으면 권하지 않는다', hasTodo: true, expected: false },
    ])('$scenario', ({ hasTodo, expected }) => {
      // Given
      const entry: TodoImportFeedEntry = { isDismissed: false, calendarAccess: 'ask' };

      // When
      const shouldShow = TodoImportFeedEntryPolicy.shouldShow(entry, hasTodo);

      // Then
      expect(shouldShow).toBe(expected);
    });

    it('닫은 계정은 할 일이 없어도 권하지 않는다', () => {
      // Given
      const entry: TodoImportFeedEntry = { isDismissed: true, calendarAccess: 'granted' };

      // When
      const shouldShow = TodoImportFeedEntryPolicy.shouldShow(entry, false);

      // Then
      expect(shouldShow).toBe(false);
    });
  });
});
