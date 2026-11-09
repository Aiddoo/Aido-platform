import { ErrorCode } from '@aido/api/errors';

import { createTodoApiError } from '../__tests__/todo.fixtures';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
  isTodoUnavailableError,
} from './todo.error';

describe('isTodoUnavailableError', () => {
  it('404는 사라진 할 일이고 API 오류가 아니면 아니다', () => {
    // Given
    const error = createTodoApiError({ status: 404 });

    // When
    const unavailable = isTodoUnavailableError(error);
    const unknown = isTodoUnavailableError(new Error('x'));

    // Then
    expect(unavailable).toBe(true);
    expect(unknown).toBe(false);
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
