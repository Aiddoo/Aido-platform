import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { toInstant } from '@src/shared/date/instant';

import { toTodoEditFormValues } from './to-todo-edit-form-values';

describe('수정 폼 기본값의 시각', () => {
  test('수정 시트 기본값도 같은 벽시계다', () => {
    // Given
    const todo = createParentTodo({ localTime: '10:00', isAllDay: false });
    // When
    const values = toTodoEditFormValues(todo, 'Asia/Seoul', null);
    // Then
    expect(values.scheduledTime).toBe('10:00');
  });

  test('종일이면 수정 시트에 시각이 없다', () => {
    // Given
    const todo = createParentTodo({ localTime: null, isAllDay: true });
    // When
    const values = toTodoEditFormValues(todo, 'Asia/Seoul', null);
    // Then
    expect(values.scheduledTime).toBeNull();
  });

  test('벽시계 칸이 없는 옛 응답은 보는 시간대로 계산하고, 칸이 있으면 시간대를 바꿔도 그대로다', () => {
    // Given
    const legacy = createParentTodo({
      localTime: null,
      scheduledAt: toInstant('2026-11-05T01:00:00.000Z'),
      isAllDay: false,
    });
    const floating = createParentTodo({ localTime: '10:00', isAllDay: false });

    // When
    const legacyInSeoul = toTodoEditFormValues(legacy, 'Asia/Seoul', null);
    const legacyInNewYork = toTodoEditFormValues(legacy, 'America/New_York', null);
    const floatingInNewYork = toTodoEditFormValues(floating, 'America/New_York', null);

    // Then
    expect(legacyInSeoul.scheduledTime).toBe('10:00');
    expect(legacyInNewYork.scheduledTime).toBe('20:00');
    expect(floatingInNewYork.scheduledTime).toBe('10:00');
  });
});
