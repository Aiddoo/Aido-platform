import { ErrorCode } from '@aido/api/errors';

import { createTodoImportApiError, IMPORT_ID } from '../__tests__/todo-import.fixtures';
import {
  calculateRemainingCapacity,
  getTodoImportStartFailure,
  getTodoImportUploadFailure,
} from './todo-import.error';

describe('getTodoImportUploadFailure', () => {
  it.each([
    {
      scenario: '한 번에 가져올 수 있는 일정 수를 넘었다',
      code: ErrorCode.TODO_IMPORT_2309,
      details: null,
      expected: 'TOO_MANY_ITEMS',
    },
    {
      scenario: '기간·일정이 올바르지 않다',
      code: ErrorCode.TODO_IMPORT_2306,
      details: null,
      expected: 'INVALID',
    },
    {
      scenario: '확정할 때 요금제 기간 한도를 넘었다',
      code: ErrorCode.TODO_IMPORT_2302,
      details: null,
      expected: 'PLAN_LIMIT',
    },
    {
      scenario: '확정할 때 새 카테고리 자리가 없었다',
      code: ErrorCode.TODO_CATEGORY_0857,
      details: null,
      expected: 'CATEGORY_LIMIT',
    },
    {
      scenario: '확정할 때 같은 이름의 카테고리가 생겼다',
      code: ErrorCode.TODO_IMPORT_2303,
      details: { targets: [{ targetKey: 'new-0', reason: 'CATEGORY_NAME_TAKEN' }] },
      expected: 'CATEGORY_NAME_TAKEN',
    },
    {
      scenario: '확정할 때 고른 카테고리가 지워졌다',
      code: ErrorCode.TODO_IMPORT_2303,
      details: { targets: [{ targetKey: 'category-1', reason: 'CATEGORY_NOT_FOUND' }] },
      expected: 'CATEGORY_NOT_FOUND',
    },
    {
      scenario: '더는 보내지 않는 자리 부족 거절이 와도',
      code: ErrorCode.TODO_IMPORT_2303,
      details: { targets: [{ targetKey: 'category-1', reason: 'CAPACITY' }] },
      expected: 'REJECTED',
    },
  ])('$scenario → $expected', ({ code, details, expected }) => {
    // Given
    const error = createTodoImportApiError({ code, details });

    // When
    const failure = getTodoImportUploadFailure(error);

    // Then
    expect(failure).toBe(expected);
  });
});

describe('getTodoImportStartFailure', () => {
  const REJECTIONS = [{ targetKey: 'category-2', reason: 'CATEGORY_NOT_FOUND' }];

  it.each([
    {
      scenario: '이미 처리 중인 가져오기가 있다',
      code: ErrorCode.TODO_IMPORT_2301,
      details: { importId: IMPORT_ID },
      expected: { kind: 'alreadyActive', importId: IMPORT_ID },
    },
    {
      scenario: '처리 중인 가져오기의 id가 오지 않았다',
      code: ErrorCode.TODO_IMPORT_2301,
      details: null,
      expected: { kind: 'other' },
    },
    {
      scenario: '요금제 기간 한도에 막혔다',
      code: ErrorCode.TODO_IMPORT_2302,
      details: null,
      expected: { kind: 'planLimit' },
    },
    {
      scenario: '새 카테고리 자리가 없다',
      code: ErrorCode.TODO_CATEGORY_0857,
      details: null,
      expected: { kind: 'planLimit' },
    },
    {
      scenario: '서버가 넣을 곳을 받지 않았다',
      code: ErrorCode.TODO_IMPORT_2303,
      details: { targets: REJECTIONS },
      expected: { kind: 'targetsRejected', rejections: REJECTIONS },
    },
    {
      scenario: '거절된 넣을 곳이 오지 않았다',
      code: ErrorCode.TODO_IMPORT_2303,
      details: null,
      expected: { kind: 'other' },
    },
    {
      scenario: '기간·일정이 올바르지 않다',
      code: ErrorCode.TODO_IMPORT_2306,
      details: null,
      expected: { kind: 'other' },
    },
  ])('$scenario → $expected.kind', ({ code, details, expected }) => {
    // Given
    const error = createTodoImportApiError({ code, details });

    // When
    const failure = getTodoImportStartFailure(error);

    // Then
    expect(failure).toEqual(expected);
  });

  it('서버 오류가 아니면 그 밖의 실패다', () => {
    // Given
    const error = new Error('네트워크가 끊겼다');

    // When
    const failure = getTodoImportStartFailure(error);

    // Then
    expect(failure).toEqual({ kind: 'other' });
  });
});

describe('calculateRemainingCapacity', () => {
  it.each([
    ['한도에서 지금 수를 뺀다', { limit: 100, current: 97 }, 3],
    ['이미 넘쳤으면 0이다', { limit: 100, current: 120 }, 0],
    ['수가 오지 않으면 0이다', {}, 0],
  ])('%s', (_case, counts, expected) => {
    // Given
    const rejection = { targetKey: 'work', reason: 'CAPACITY' as const, ...counts };

    // When
    const remaining = calculateRemainingCapacity(rejection);

    // Then
    expect(remaining).toBe(expected);
  });
});
