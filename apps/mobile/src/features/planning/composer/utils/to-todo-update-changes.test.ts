import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';
import {
  hasOnlyDateChanges,
  hasTodoUpdateChanges,
  toTodoUpdateChanges,
} from './to-todo-update-changes';

const DEFAULTS: AddTodoFormValues = {
  title: '운동',
  startDate: new Date(2026, 10, 5, 12),
  endDate: null,
  scheduledTime: '09:00',
  isAllDay: false,
  categoryId: 1,
  visibility: 'PUBLIC',
  repeat: { frequency: 'WEEKLY', interval: 1, weekdays: ['MON', 'THU'], end: { type: 'NEVER' } },
};

describe('toTodoUpdateChanges', () => {
  test('바뀐 게 없으면 보낼 것이 없다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: {} });
    expect(hasTodoUpdateChanges(changes)).toBe(false);
  });

  test('제목만 고치면 제목만 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, title: '달리기' }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: { title: '달리기' } });
  });

  test('카테고리도 바뀐 값으로 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, categoryId: 2 }, DEFAULTS);

    // Then
    expect(changes.input).toEqual({ categoryId: 2 });
  });

  test('종일로 바꾸면 시간은 null로 비운다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, isAllDay: true }, DEFAULTS);

    // Then
    expect(changes.input).toEqual({ scheduledTime: null, isAllDay: true });
  });

  test('요일 순서만 달라도 같은 규칙이라 repeat을 보내지 않는다', () => {
    // When
    const changes = toTodoUpdateChanges(
      {
        ...DEFAULTS,
        repeat: {
          frequency: 'WEEKLY',
          interval: 1,
          weekdays: ['THU', 'MON'],
          end: { type: 'NEVER' },
        },
      },
      DEFAULTS,
    );

    // Then
    expect(hasTodoUpdateChanges(changes)).toBe(false);
  });

  test('반복을 없애면 repeat null로 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, repeat: null }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: {}, repeat: null });
    expect(hasTodoUpdateChanges(changes)).toBe(true);
  });

  test('날짜만 옮기면 날짜 변경으로 본다', () => {
    // When
    const changes = toTodoUpdateChanges(
      { ...DEFAULTS, startDate: new Date(2026, 10, 6, 12) },
      DEFAULTS,
    );

    // Then
    expect(changes.input).toEqual({ startDate: '2026-11-06' });
    expect(hasOnlyDateChanges(changes)).toBe(true);
  });
});
