import { ApiError } from '@src/core/errors/api-error';

import {
  isTodoSeriesNotFoundError,
  TodoSeriesNotCreatedError,
  getTodoSeriesFailure,
  shouldRefreshTodos,
  shouldReopenRepeatPicker,
} from './todo-series.error';

describe('getTodoSeriesFailure', () => {
  test('지난 회차가 너무 많아 시작일을 거절하면 시작일을 다시 고르게 반복 시트를 연다', () => {
    // Given
    const error = new ApiError('TODO_0845', '거절', 400, { field: 'startDate' });

    // When
    const failure = getTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('too-many-past');
    expect(shouldReopenRepeatPicker(error)).toBe(true);
  });

  test('그 밖의 반복 설정 거절은 일반 안내다', () => {
    // Given
    const error = new ApiError('TODO_0845', '거절', 400, { field: 'endDate' });

    // When
    const failure = getTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('invalid');
  });

  test('대상 카테고리가 가득 차면 반복 시트를 열지 않고 목록도 다시 읽지 않아 입력을 그대로 둔다', () => {
    // Given
    const error = new ApiError('TODO_0811', '가득 참', 403);

    // When
    const failure = getTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('category-full');
    expect(shouldReopenRepeatPicker(error)).toBe(false);
    expect(shouldRefreshTodos('category-full')).toBe(false);
  });

  test('끝난 규칙을 되살릴 때 상한에 닿으면 상한 안내고 입력을 그대로 둔다', () => {
    // Given
    const error = new ApiError('TODO_0842', '상한', 403, { limit: 100, activeCount: 100 });

    // When
    const failure = getTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('limit');
    expect(shouldReopenRepeatPicker(error)).toBe(false);
    expect(shouldRefreshTodos('limit')).toBe(false);
  });
});

describe('isTodoSeriesNotFoundError', () => {
  test.each([
    { name: '규칙 없음 코드', error: new ApiError('TODO_0841', '없음', 404), expected: true },
    { name: '옛 서버에 없는 경로', error: new ApiError('SYS_0002', '없음', 404), expected: true },
    { name: '입력 오류', error: new ApiError('SYS_0002', '잘못됨', 400), expected: false },
    { name: '다른 404', error: new ApiError('TODO_0801', '없음', 404), expected: false },
  ])('$name이면 $expected', ({ error, expected }) => {
    // When
    const result = isTodoSeriesNotFoundError(error);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoSeriesNotCreatedError', () => {
  test('입력을 지키고 목록을 새로 읽는 실패로 분류한다', () => {
    // Given
    const error = new TodoSeriesNotCreatedError();

    // When
    const failure = getTodoSeriesFailure(error);

    // Then
    expect(failure).toBe('not-created');
    expect(shouldReopenRepeatPicker(error)).toBe(false);
    expect(shouldRefreshTodos('not-created')).toBe(true);
  });
});
