import { defineFixture } from '@src/testing/fixture';

import { subTodoSchema } from '../domains/sub-todo.model';
import { todoSchema } from '../domains/todo.model';

export const createSubTodo = defineFixture(subTodoSchema, {
  id: 1,
  title: '테스트 항목',
  completed: false,
  sortOrder: 0,
});

export const createParentTodo = defineFixture(todoSchema, {
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
  commentCount: 0,
});
