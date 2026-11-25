import { ErrorCode, type ErrorCodeType, HttpStatus } from '@aido/api/errors';
import { createApiError } from '@src/testing/core';

import {
  findTodoSeriesFailure,
  findTodoSeriesLimit,
  shouldRefreshTodos,
  shouldReopenRepeatPicker,
  type TodoSeriesFailure,
} from './todo-series.error';

describe('findTodoSeriesFailure', () => {
  it.each([
    { code: ErrorCode.TODO_0841, details: { seriesId: 's' }, expected: 'not-found' },
    { code: ErrorCode.TODO_0842, details: { limit: 100, activeCount: 100 }, expected: 'limit' },
    { code: ErrorCode.TODO_0843, details: { startDate: '2026-11-12' }, expected: 'no-dates' },
    { code: ErrorCode.TODO_0844, details: { todoId: 1, scope: 'ALL' }, expected: 'not-repeating' },
    { code: ErrorCode.TODO_0845, details: { field: 'startDate' }, expected: 'too-many-past' },
    { code: ErrorCode.TODO_0845, details: { field: 'endDate' }, expected: 'invalid' },
    { code: ErrorCode.TODO_0845, details: undefined, expected: 'invalid' },
    { code: ErrorCode.TODO_0811, details: undefined, expected: 'category-full' },
    { code: ErrorCode.TODO_0846, details: { seriesId: 's' }, expected: 'ended' },
    { code: ErrorCode.TODO_0801, details: undefined, expected: null },
  ] satisfies {
    code: ErrorCodeType;
    details: Record<string, unknown> | undefined;
    expected: TodoSeriesFailure | null;
  }[])('$code $details 거절은 $expected다', ({ code, details, expected }) => {
    // Given
    const error = createApiError(code, { message: '거절', status: 400, details });

    // When
    const failure = findTodoSeriesFailure(error);

    // Then
    expect(failure).toBe(expected);
  });

  it('API 오류가 아니면 반복 묶음 오류가 아니다', () => {
    // When
    const failure = findTodoSeriesFailure(new Error('network'));

    // Then
    expect(failure).toBeNull();
  });
});

describe('shouldReopenRepeatPicker', () => {
  it('시작일을 거절당하면 시작일을 다시 고르게 반복 시트를 연다', () => {
    // Given
    const error = createApiError(ErrorCode.TODO_0845, {
      message: '거절',
      details: {
        field: 'startDate',
      },
    });

    // When
    const result = shouldReopenRepeatPicker(error);

    // Then
    expect(result).toBe(true);
  });

  it('대상 카테고리가 가득 차거나 상한에 닿으면 반복 시트를 열지 않고 입력을 그대로 둔다', () => {
    // Given
    const categoryFull = createApiError(ErrorCode.TODO_0811, { message: '가득 참' });
    const limit = createApiError(ErrorCode.TODO_0842, {
      message: '상한',
      details: {
        limit: 100,
        activeCount: 100,
      },
    });

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

describe('findTodoSeriesLimit', () => {
  it('서버 오류 상세의 한도를 그대로 쓴다', () => {
    // Given
    const error = createApiError(ErrorCode.TODO_0842, {
      message: '거절',
      status: HttpStatus.BAD_REQUEST,
      details: {
        limit: 12,
        activeCount: 12,
      },
    });

    // When
    const limit = findTodoSeriesLimit(error);

    // Then
    expect(limit).toBe(12);
  });

  it('한도를 쓰지 않는 실패는 한도가 없다', () => {
    // Given
    const error = createApiError(ErrorCode.TODO_0841, { message: '없음' });

    // When
    const limit = findTodoSeriesLimit(error);

    // Then
    expect(limit).toBeNull();
  });
});
