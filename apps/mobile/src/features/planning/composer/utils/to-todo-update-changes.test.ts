import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';

import { toTodoUpdateChanges } from './to-todo-update-changes';

const DEFAULTS: TodoFormValues = {
  title: '운동',
  startDate: '2026-11-05',
  endDate: null,
  scheduledTime: '09:00',
  isAllDay: false,
  categoryId: 1,
  visibility: 'PUBLIC',
  repeat: { frequency: 'WEEKLY', interval: 1, weekdays: ['MON', 'THU'], end: { type: 'NEVER' } },
};

describe('toTodoUpdateChanges', () => {
  it('바뀐 게 없으면 보낼 것이 없다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: {} });
  });

  it('제목만 고치면 제목만 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, title: '달리기' }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: { title: '달리기' } });
  });

  it('카테고리도 바뀐 값으로 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, categoryId: 2 }, DEFAULTS);

    // Then
    expect(changes.input).toEqual({ categoryId: 2 });
  });

  it('종일로 바꾸면 시간은 null로 비운다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, isAllDay: true }, DEFAULTS);

    // Then
    expect(changes.input).toEqual({ scheduledTime: null, isAllDay: true });
  });

  it('요일 순서만 달라도 같은 규칙이라 repeat을 보내지 않는다', () => {
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
    expect(changes).toEqual({ input: {} });
  });

  it('반복을 없애면 repeat null로 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, repeat: null }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: {}, repeat: null });
  });

  it('날짜만 옮기면 날짜만 보낸다', () => {
    // When
    const changes = toTodoUpdateChanges({ ...DEFAULTS, startDate: '2026-11-06' }, DEFAULTS);

    // Then
    expect(changes).toEqual({ input: { startDate: '2026-11-06' } });
  });
});
