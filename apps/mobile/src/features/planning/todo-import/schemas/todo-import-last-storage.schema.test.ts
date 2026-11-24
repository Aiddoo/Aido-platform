import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemorySyncStorage } from '@src/testing/core';

import { IMPORT_ID } from '../__tests__/todo-import.fixtures';
import {
  lastTodoImportIdsStoredValue,
  rememberTodoImportId,
} from './todo-import-last-storage.schema';

const ACCOUNT_ID = 'account-1';
const PREVIOUS_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8a';
const OLDEST_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8b';
const NEWEST_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8c';

describe('rememberTodoImportId', () => {
  it.each([
    {
      scenario: '새 가져오기가 앞에 오고 앞의 가져오기는 뒤에 남아 다시 보일 수 있다',
      ids: [IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID],
    },
    {
      scenario: '이미 있는 가져오기는 앞으로 옮기고 겹쳐 남기지 않는다',
      ids: [IMPORT_ID, PREVIOUS_IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID],
    },
    {
      scenario: '세 개를 넘으면 가장 오래된 것을 뺀다',
      ids: [IMPORT_ID, OLDEST_IMPORT_ID, NEWEST_IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID, OLDEST_IMPORT_ID],
    },
  ])('$scenario', ({ ids, expected }) => {
    // When
    const remembered = rememberTodoImportId(ids, PREVIOUS_IMPORT_ID);

    // Then
    expect(remembered).toEqual(expected);
  });
});

describe('lastTodoImportIdsStoredValue', () => {
  it('출시 전 QA 빌드가 남긴 id 하나는 목록으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(`aido_todo_import_last_v1:${ACCOUNT_ID}`, IMPORT_ID);

    // When
    const ids = readStoredValue(storage, lastTodoImportIdsStoredValue, ACCOUNT_ID);

    // Then
    expect(ids).toEqual([IMPORT_ID]);
  });

  it('쓴 목록을 그대로 다시 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    writeStoredValue(
      storage,
      lastTodoImportIdsStoredValue,
      [NEWEST_IMPORT_ID, IMPORT_ID],
      ACCOUNT_ID,
    );

    // When
    const ids = readStoredValue(storage, lastTodoImportIdsStoredValue, ACCOUNT_ID);

    // Then
    expect(ids).toEqual([NEWEST_IMPORT_ID, IMPORT_ID]);
  });
});
