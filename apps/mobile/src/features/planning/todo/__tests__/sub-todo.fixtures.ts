import type { SubTodo } from '../schemas/sub-todo.schema';
import type { Todo } from '../schemas/todo.schema';

function generateSubTodo(): SubTodo {
  return {
    id: 1,
    title: '테스트 항목',
    completed: false,
    sortOrder: 0,
  };
}

export function createSubTodo(overrides?: Partial<SubTodo>): SubTodo {
  return {
    ...generateSubTodo(),
    ...overrides,
  };
}

function generateParentTodo(): Todo {
  return {
    id: 1,
    title: '테스트 할일',
    startDate: '2026-03-08',
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
    subTodoStats: { total: 0, completed: 0 },
    commentCount: 0,
  };
}

export function createParentTodo(overrides?: Partial<Todo>): Todo {
  return {
    ...generateParentTodo(),
    ...overrides,
  };
}
