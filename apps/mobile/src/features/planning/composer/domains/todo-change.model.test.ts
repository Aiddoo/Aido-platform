import { createTodoFormValues } from '@src/features/planning/todo/__tests__/todo.fixtures';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { createDateKey } from '@src/testing/date-key';

import {
  getTodoUpdateChanges,
  TodoChangePolicy,
  type TodoUpdateChanges,
} from './todo-change.model';

const SAVED = createTodoFormValues({
  title: '운동',
  startDate: createDateKey('2026-11-05'),
  scheduledTime: '09:00',
  isAllDay: false,
  repeat: { frequency: 'WEEKLY', interval: 1, weekdays: ['MON', 'THU'], end: { type: 'NEVER' } },
});

describe('getTodoUpdateChanges', () => {
  it.each([
    { name: '바뀐 게 없으면 보낼 것이 없다', edited: {}, expected: { fields: {} } },
    {
      name: '제목만 고치면 제목만 보낸다',
      edited: { title: '달리기' },
      expected: { fields: { title: '달리기' } },
    },
    {
      name: '종일로 바꾸면 시간은 null로 비운다',
      edited: { isAllDay: true },
      expected: { fields: { scheduledTime: null, isAllDay: true } },
    },
    {
      name: '요일 순서만 달라도 같은 규칙이라 반복을 보내지 않는다',
      edited: {
        repeat: {
          frequency: 'WEEKLY',
          interval: 1,
          weekdays: ['THU', 'MON'],
          end: { type: 'NEVER' },
        },
      },
      expected: { fields: {} },
    },
    {
      name: '반복을 없애면 반복을 null로 보낸다',
      edited: { repeat: null },
      expected: { fields: {}, repeat: null },
    },
    {
      name: '날짜만 옮기면 날짜만 보낸다',
      edited: { startDate: createDateKey('2026-11-06') },
      expected: { fields: { startDate: createDateKey('2026-11-06') } },
    },
  ] satisfies { name: string; edited: Partial<TodoFormValues>; expected: TodoUpdateChanges }[])(
    '$name',
    ({ edited, expected }) => {
      // When
      const changes = getTodoUpdateChanges({ ...SAVED, ...edited }, SAVED);

      // Then
      expect(changes).toEqual(expected);
    },
  );
});

describe('hasTodoUpdateChanges', () => {
  it.each([
    ['바뀐 칸이 없으면', { fields: {} }, false],
    ['제목이 바뀌면', { fields: { title: '달리기' } }, true],
    ['반복을 끝내면(repeat null)', { fields: {}, repeat: null }, true],
  ] as const)('%s %s다', (_label, changes, expected) => {
    // When
    const result = TodoChangePolicy.hasTodoUpdateChanges(changes);

    // Then
    expect(result).toBe(expected);
  });
});

describe('hasOnlyDateChanges', () => {
  const day = createDateKey('2026-11-06');
  it.each([
    ['시작일만 바뀌면', { fields: { startDate: day } }, true],
    [
      '시작일과 종료일만 바뀌면',
      { fields: { startDate: day, endDate: createDateKey('2026-11-07') } },
      true,
    ],
    ['바뀐 칸이 없으면', { fields: {} }, false],
    ['날짜와 제목이 함께 바뀌면', { fields: { startDate: day, title: '달리기' } }, false],
    ['날짜와 함께 반복을 끝내면', { fields: { startDate: day }, repeat: null }, false],
  ] as const)('%s %s다', (_label, changes, expected) => {
    // When
    const result = TodoChangePolicy.hasOnlyDateChanges(changes);

    // Then
    expect(result).toBe(expected);
  });
});
