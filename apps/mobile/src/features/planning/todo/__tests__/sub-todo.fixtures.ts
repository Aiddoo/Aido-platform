import { createDateKey } from '@src/testing/date-key';

import { type SubTodo, subTodoSchema } from '../domains/sub-todo.model';
import { type Todo, todoSchema } from '../domains/todo.model';

function generateSubTodo(): SubTodo {
  return {
    id: 1,
    title: '테스트 항목',
    completed: false,
    sortOrder: 0,
  };
}

export function createSubTodo(overrides?: Partial<SubTodo>): SubTodo {
  return subTodoSchema.parse({
    ...generateSubTodo(),
    ...overrides,
  });
}

function generateParentTodo(): Todo {
  return {
    id: 1,
    title: '테스트 할일',
    startDate: createDateKey('2026-03-08'),
    endDate: null,
    category: { id: 1, name: '기본', color: '#3B82F6' },
    completed: false,
    localTime: null,
    scheduledAt: null,
    isAllDay: false,
    visibility: 'PUBLIC',
    recurrenceGroupId: null,
    repeat: null,
    subTodos: [],
    commentCount: 0,
  };
}

export function createParentTodo(overrides?: Partial<Todo>): Todo {
  return todoSchema.parse({
    ...generateParentTodo(),
    ...overrides,
  });
}
