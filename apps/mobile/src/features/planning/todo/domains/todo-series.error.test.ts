import { ApiError } from '@src/core/errors/api-error';

import {
  findTodoSeriesFailure,
  getTodoSeriesLimit,
  shouldRefreshTodos,
  shouldReopenRepeatPicker,
  type TodoSeriesFailure,
} from './todo-series.error';

describe('findTodoSeriesFailure', () => {
  it('지난 회차가 너무 많아 시작일을 거절하면 too-many-past다', () => {
    // Given
    const error = new ApiError('TODO_0845', '거절', 400, { field: 'startDate' });

    // When
    const failure = findTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('too-many-past');
  });

  it('그 밖의 반복 설정 거절은 일반 안내다', () => {
    // Given
    const error = new ApiError('TODO_0845', '거절', 400, { field: 'endDate' });

    // When
    const failure = findTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('invalid');
  });

  it('대상 카테고리가 가득 차면 category-full이다', () => {
    // Given
    const error = new ApiError('TODO_0811', '가득 참', 403);

    // When
    const failure = findTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('category-full');
  });

  it('끝난 규칙을 되살릴 때 상한에 닿으면 limit이다', () => {
    // Given
    const error = new ApiError('TODO_0842', '상한', 403, { limit: 100, activeCount: 100 });

    // When
    const failure = findTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('limit');
  });
});

describe('shouldReopenRepeatPicker', () => {
  it('시작일을 거절당하면 시작일을 다시 고르게 반복 시트를 연다', () => {
    // Given
    const error = new ApiError('TODO_0845', '거절', 400, { field: 'startDate' });

    // When
    const result = shouldReopenRepeatPicker(error);

    // Then
    expect(result).toBe(true);
  });

  it('대상 카테고리가 가득 차거나 상한에 닿으면 반복 시트를 열지 않고 입력을 그대로 둔다', () => {
    // Given
    const categoryFull = new ApiError('TODO_0811', '가득 참', 403);
    const limit = new ApiError('TODO_0842', '상한', 403, { limit: 100, activeCount: 100 });

    // When
    const categoryFullResult = shouldReopenRepeatPicker(categoryFull);
    const limitResult = shouldReopenRepeatPicker(limit);

    // Then
    expect(categoryFullResult).toBe(false);
    expect(limitResult).toBe(false);
  });
});

describe('shouldRefreshTodos', () => {
  it.each([
    { failure: 'not-found', expected: true },
    { failure: 'not-repeating', expected: true },
    { failure: 'ended', expected: true },
    { failure: 'category-full', expected: false },
    { failure: 'limit', expected: false },
  ] satisfies { failure: TodoSeriesFailure; expected: boolean }[])(
    '$failure 실패이면 목록을 다시 읽는지는 $expected다',
    ({ failure, expected }) => {
      // When
      const result = shouldRefreshTodos(failure);

      // Then
      expect(result).toBe(expected);
    },
  );
});

describe('getTodoSeriesLimit', () => {
  it('서버 오류 상세의 한도를 그대로 쓴다', () => {
    // Given
    const error = new ApiError('TODO_0842', '거절', 400, { limit: 12, activeCount: 12 });

    // When
    const limit = getTodoSeriesLimit(error);

    // Then
    expect(limit).toBe(12);
  });

  it('상세에 한도가 없으면 공유 상한을 쓴다', () => {
    // Given
    const error = new ApiError('TODO_0842', '거절', 400);

    // When
    const limit = getTodoSeriesLimit(error);

    // Then
    expect(limit).toBe(30);
  });
});
