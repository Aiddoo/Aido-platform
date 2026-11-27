import {
  type TodoImportFeedEntry,
  TodoImportFeedEntryPolicy,
} from './todo-import-feed-entry.model';

const NEW_ACCOUNT: TodoImportFeedEntry = {
  isDismissed: false,
  calendarAccess: 'ask',
  hasTodayTodo: false,
  hasTodoRecord: false,
};

describe('TodoImportFeedEntryPolicy', () => {
  describe('shouldAskTodoRecord', () => {
    const cases: { scenario: string; entry: TodoImportFeedEntry; expected: boolean }[] = [
      { scenario: '권한을 아직 묻지 않았으면 묻는다', entry: NEW_ACCOUNT, expected: true },
      {
        scenario: '이미 허용했어도 묻는다',
        entry: { ...NEW_ACCOUNT, calendarAccess: 'granted' },
        expected: true,
      },
      {
        scenario: '오늘 할 일이 보이면 이미 할 일이 있어 묻지 않는다',
        entry: { ...NEW_ACCOUNT, hasTodayTodo: true },
        expected: false,
      },
      {
        scenario: '닫았으면 묻지 않는다',
        entry: { ...NEW_ACCOUNT, isDismissed: true },
        expected: false,
      },
      {
        scenario: '설정에서만 켤 수 있게 거절했으면 묻지 않는다',
        entry: { ...NEW_ACCOUNT, calendarAccess: 'settings' },
        expected: false,
      },
    ];

    it.each(cases)('$scenario', ({ entry, expected }) => {
      // When
      const shouldAsk = TodoImportFeedEntryPolicy.shouldAskTodoRecord(entry);

      // Then
      expect(shouldAsk).toBe(expected);
    });
  });

  describe('shouldShow', () => {
    const cases: { scenario: string; entry: TodoImportFeedEntry; expected: boolean }[] = [
      { scenario: '서버 기록에 할 일이 없으면 권한다', entry: NEW_ACCOUNT, expected: true },
      {
        scenario: '서버 기록에 할 일이 있으면 권하지 않는다',
        entry: { ...NEW_ACCOUNT, hasTodoRecord: true },
        expected: false,
      },
      {
        scenario: '서버 기록을 아직 모르면 권하지 않는다',
        entry: { ...NEW_ACCOUNT, hasTodoRecord: null },
        expected: false,
      },
      {
        scenario: '닫은 계정은 할 일이 없어도 권하지 않는다',
        entry: { ...NEW_ACCOUNT, isDismissed: true },
        expected: false,
      },
      {
        scenario: '오늘 할 일이 보이면 예전 기록이 비어 있어도 권하지 않는다',
        entry: { ...NEW_ACCOUNT, hasTodayTodo: true },
        expected: false,
      },
    ];

    it.each(cases)('$scenario', ({ entry, expected }) => {
      // When
      const shouldShow = TodoImportFeedEntryPolicy.shouldShow(entry);

      // Then
      expect(shouldShow).toBe(expected);
    });
  });
});
