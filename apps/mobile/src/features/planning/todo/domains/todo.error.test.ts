import { ErrorCode } from '@aido/api/errors';

import { createTodoApiError } from '../__tests__/todo.fixtures';
import {
  isCategoryTodoLimitError,
  isRecurringCategoryTodoLimitError,
  isTodoUnavailableError,
} from './todo.error';

describe('할 일 오류 판별', () => {
  test('404는 사라진 할 일이다', () => {
    // Given
    const error = createTodoApiError({ status: 404 });

    // When & Then
    expect(isTodoUnavailableError(error)).toBe(true);
    expect(isTodoUnavailableError(new Error('x'))).toBe(false);
  });

  test('카테고리 한도 코드를 구분한다', () => {
    // Given
    const category = createTodoApiError({ code: ErrorCode.TODO_0811 });
    const recurring = createTodoApiError({ code: ErrorCode.TODO_0813 });

    // When & Then
    expect(isCategoryTodoLimitError(category)).toBe(true);
    expect(isCategoryTodoLimitError(recurring)).toBe(false);
    expect(isRecurringCategoryTodoLimitError(recurring)).toBe(true);
  });
});
