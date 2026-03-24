import type { SubTodo } from '../models/sub-todo.model';
import type { TodoItem } from '../models/todo.model';

const generateSubTodo = (): SubTodo => ({
  id: 1,
  title: '테스트 항목',
  completed: false,
  sortOrder: 0,
});

export const createSubTodo = (overrides?: Partial<SubTodo>): SubTodo => ({
  ...generateSubTodo(),
  ...overrides,
});

const generateParentTodo = (): TodoItem => ({
  id: 1,
  title: '테스트 할일',
  startDate: '2026-03-08',
  endDate: null,
  category: { id: 1, name: '기본', color: '#3B82F6' },
  completed: false,
  scheduledTime: null,
  isAllDay: false,
  visibility: 'PUBLIC',
  recurrenceGroupId: null,
  subTodos: [],
  subTodoStats: { total: 0, completed: 0 },
});

export const createParentTodo = (overrides?: Partial<TodoItem>): TodoItem => ({
  ...generateParentTodo(),
  ...overrides,
});
