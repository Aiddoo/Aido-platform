import { ErrorCode } from '@aido/api/errors';

import { getTodoImportUploadFailure } from './todo-import.error';

describe('getTodoImportUploadFailure', () => {
  it('한 번에 가져올 수 있는 일정 수를 넘어 멈췄으면 그 이유를 고른다', () => {
    // When
    const failure = getTodoImportUploadFailure(ErrorCode.TODO_IMPORT_2309);

    // Then
    expect(failure).toBe('TOO_MANY_ITEMS');
  });

  it('기간·일정이 올바르지 않아 멈췄으면 읽지 못한 이유를 고른다', () => {
    // When
    const failure = getTodoImportUploadFailure(ErrorCode.TODO_IMPORT_2306);

    // Then
    expect(failure).toBe('INVALID');
  });

  it('그 밖의 거절은 받지 못한 이유로 묶는다', () => {
    // When
    const failure = getTodoImportUploadFailure(ErrorCode.TODO_IMPORT_2303);

    // Then
    expect(failure).toBe('REJECTED');
  });
});
