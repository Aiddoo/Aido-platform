import { ErrorCode } from '@aido/api/errors';

import { createTodoApiError } from '../__tests__/todo.fixtures';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
  isTodoUnavailableError,
} from './todo.error';

describe('isTodoUnavailableError', () => {
  it.each([
    {
      name: '지웠거나 볼 수 없는 할 일(TODO_0801)',
      error: createTodoApiError({ code: ErrorCode.TODO_0801 }),
      expected: true,
    },
    {
      name: '다른 404(TODO_0810)',
      error: createTodoApiError({ code: ErrorCode.TODO_0810 }),
      expected: false,
    },
    { name: 'API 오류가 아닌 것', error: new Error('x'), expected: false },
  ])('$name이면 $expected다', ({ error, expected }) => {
    // When
    const unavailable = isTodoUnavailableError(error);

    // Then
    expect(unavailable).toBe(expected);
  });
});

describe('isCategoryTodoLimitError', () => {
  it('카테고리 한도 코드만 참이고 반복 한도 코드는 아니다', () => {
    // Given
    const category = createTodoApiError({ code: ErrorCode.TODO_0811 });
    const recurring = createTodoApiError({ code: ErrorCode.TODO_0813 });

    // When
    const categoryResult = isCategoryTodoLimitError(category);
    const recurringResult = isCategoryTodoLimitError(recurring);

    // Then
    expect(categoryResult).toBe(true);
    expect(recurringResult).toBe(false);
  });
});

describe('isRecurringCategoryTodoLimitError', () => {
  it('반복 할 일의 카테고리 한도 코드는 참이다', () => {
    // Given
    const recurring = createTodoApiError({ code: ErrorCode.TODO_0813 });

    // When
    const result = isRecurringCategoryTodoLimitError(recurring);

    // Then
    expect(result).toBe(true);
  });
});
