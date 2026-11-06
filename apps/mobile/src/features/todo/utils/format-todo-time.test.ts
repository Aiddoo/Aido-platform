import type { DateFormatContext } from '@src/shared/utils/date-format';

import { createParentTodo } from '../__tests__/sub-todo.factories';
import { formatTodoTime } from './format-todo-time';
import { toTodoEditFormValues } from './to-todo-edit-form-values';

const SEOUL: DateFormatContext = { locale: 'ko-KR', timeZone: 'Asia/Seoul' };
const NEW_YORK: DateFormatContext = { locale: 'ko-KR', timeZone: 'America/New_York' };

describe('떠 있는 시각 표시', () => {
  test.each([SEOUL, NEW_YORK])('어느 기기 시간대든 고른 시각 그대로다 (%o)', (context) => {
    // Given
    const todo = createParentTodo({ localTime: '10:00', isAllDay: false });
    // When
    const label = formatTodoTime(todo, 'TWENTY_FOUR_HOUR', context);
    // Then
    expect(label).toBe('10:00');
  });

  test('종일이거나 시각이 없으면 표시하지 않는다', () => {
    // Given
    const allDayTodo = createParentTodo({ localTime: '10:00', isAllDay: true });
    const noTimeTodo = createParentTodo({ localTime: null, isAllDay: false });
    // When
    const allDay = formatTodoTime(allDayTodo, 'TWELVE_HOUR', SEOUL);
    const noTime = formatTodoTime(noTimeTodo, 'TWELVE_HOUR', SEOUL);
    // Then
    expect(allDay).toBeNull();
    expect(noTime).toBeNull();
  });

  test('수정 시트 기본값도 같은 벽시계다', () => {
    // Given
    const todo = createParentTodo({ localTime: '10:00', isAllDay: false });
    // When
    const values = toTodoEditFormValues(todo, null);
    // Then
    expect(values.scheduledTime).toBe('10:00');
  });

  test('종일이면 수정 시트에 시각이 없다', () => {
    // Given
    const todo = createParentTodo({ localTime: null, isAllDay: true });
    // When
    const values = toTodoEditFormValues(todo, null);
    // Then
    expect(values.scheduledTime).toBeNull();
  });
});
