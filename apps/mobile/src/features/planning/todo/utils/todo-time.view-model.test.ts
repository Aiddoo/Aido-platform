import { type DateFormatContext } from '@src/shared/date/format/date-format';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { formatTodoTime } from './todo-time.view-model';

const SEOUL: DateFormatContext = { locale: 'ko-KR', timeZone: 'Asia/Seoul' };
const NEW_YORK: DateFormatContext = { locale: 'ko-KR', timeZone: 'America/New_York' };

describe('formatTodoTime', () => {
  it.each([SEOUL, NEW_YORK])('어느 기기 시간대든 고른 시각 그대로다 (%o)', (context) => {
    // Given
    const todo = createParentTodo({ localTime: '10:00', isAllDay: false });
    // When
    const label = formatTodoTime(todo, 'TWENTY_FOUR_HOUR', context);
    // Then
    expect(label).toBe('10:00');
  });

  it('종일이거나 시각이 없으면 표시하지 않는다', () => {
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
});
