import {
  type TodoImportFeedEntry,
  TodoImportFeedEntryPolicy,
} from './todo-import-feed-entry.model';

const NEW_ACCOUNT: TodoImportFeedEntry = {
  closedReason: null,
  calendarAccess: 'ask',
  hasTodayTodo: false,
  hasTodoRecord: false,
};

interface PolicyCase {
  scenario: string;
  entry: TodoImportFeedEntry;
  expected: boolean;
}

describe('TodoImportFeedEntryPolicy', () => {
  describe('shouldAskTodoRecord', () => {
    const cases: PolicyCase[] = [
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
        scenario: '사용자가 닫았으면 묻지 않는다',
        entry: { ...NEW_ACCOUNT, closedReason: 'dismissed' },
        expected: false,
      },
      {
        scenario: '할 일이 있는 계정으로 남겼으면 다시 묻지 않는다',
        entry: { ...NEW_ACCOUNT, closedReason: 'hasTodo' },
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
    const cases: PolicyCase[] = [
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
        entry: { ...NEW_ACCOUNT, closedReason: 'dismissed' },
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

  describe('shouldRememberHasTodo', () => {
    const cases: PolicyCase[] = [
      {
        scenario: '서버가 할 일이 있다고 답하면 남긴다',
        entry: { ...NEW_ACCOUNT, hasTodoRecord: true },
        expected: true,
      },
      {
        scenario:
          '오늘 목록에 줄이 보여도 서버 답이 없으면 남기지 않는다(낙관적 줄은 되돌아갈 수 있다)',
        entry: { ...NEW_ACCOUNT, hasTodayTodo: true, hasTodoRecord: null },
        expected: false,
      },
      {
        scenario: '서버가 할 일이 없다고 답하면 남기지 않는다',
        entry: NEW_ACCOUNT,
        expected: false,
      },
      {
        scenario: '이미 닫은 이유가 있으면 덮어쓰지 않는다',
        entry: { ...NEW_ACCOUNT, closedReason: 'dismissed', hasTodoRecord: true },
        expected: false,
      },
    ];

    it.each(cases)('$scenario', ({ entry, expected }) => {
      // When
      const shouldRemember = TodoImportFeedEntryPolicy.shouldRememberHasTodo(entry);

      // Then
      expect(shouldRemember).toBe(expected);
    });
  });
});
