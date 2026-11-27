import { createTodoCategoryWithCount } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createDateKey } from '@src/testing/date-key';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TodoListPolicy, type TodoListResult } from './todo-list.model';
import type { Todo } from './todo.model';

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const first = createParentTodo({ id: 1 });
const second = createParentTodo({ id: 2 });

describe('TodoListPolicy', () => {
  describe('findTodo', () => {
    it('목록에서 사라진 할 일은 찾지 못한다', () => {
      // Given
      const todos = [createParentTodo({ id: 1 }), createParentTodo({ id: 2 })];

      // When
      const found = TodoListPolicy.findTodo(toList(todos), 2);
      const deleted = TodoListPolicy.findTodo(toList(todos), 9);

      // Then
      expect(found?.id).toBe(2);
      expect(deleted).toBeNull();
    });
  });

  describe('isLastOpenTodo', () => {
    it('할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다', () => {
      // Given
      const todos = [createParentTodo({ id: 1, completed: true })];

      // When
      const result = TodoListPolicy.isLastOpenTodo(toList(todos), 1);

      // Then
      expect(result).toBe(true);
    });

    it('어제 시작한 여러 날 할 일을 오늘 끝내면 오늘 목록에 미완료로 남아 있어도 끝낸 것으로 본다', () => {
      // Given
      const multiDay = createParentTodo({
        id: 7,
        startDate: createDateKey('2026-10-26'),
        endDate: createDateKey('2026-10-28'),
        completed: false,
      });
      const lastOpen = [createParentTodo({ id: 1, completed: true }), multiDay];
      const oneMoreOpen = [...lastOpen, createParentTodo({ id: 2, completed: false })];

      // When
      const lastOpenResult = TodoListPolicy.isLastOpenTodo(toList(lastOpen), 7);
      const oneMoreOpenResult = TodoListPolicy.isLastOpenTodo(toList(oneMoreOpen), 7);

      // Then
      // 낙관적 갱신은 시작일 목록에만 반영돼 오늘 목록에는 아직 미완료다
      expect(lastOpenResult).toBe(true);
      expect(oneMoreOpenResult).toBe(false);
    });

    it('끝낸 할 일이 그날 목록에 없거나 할 일이 없는 날은 다 끝낸 날이 아니다', () => {
      // Given
      const todos = [createParentTodo({ id: 1, completed: true })];

      // When
      const notInList = TodoListPolicy.isLastOpenTodo(toList(todos), 9);
      const emptyDay = TodoListPolicy.isLastOpenTodo(toList([]), 1);

      // Then
      expect(notInList).toBe(false);
      expect(emptyDay).toBe(false);
    });
  });

  describe('hasUpcomingTimedTodo', () => {
    const now = { dateKey: createDateKey('2026-11-05'), time: '12:00', timezone: 'Asia/Seoul' };

    it.each([
      [
        '내일 시간 있는 할 일',
        { startDate: createDateKey('2026-11-06'), localTime: '09:00' },
        true,
      ],
      [
        '오늘 아직 지나지 않은 시각',
        { startDate: createDateKey('2026-11-05'), localTime: '12:30' },
        true,
      ],
      [
        '오늘 이미 지난 시각',
        { startDate: createDateKey('2026-11-05'), localTime: '11:59' },
        false,
      ],
      ['어제 시각', { startDate: createDateKey('2026-11-04'), localTime: '23:00' }, false],
      ['종일 할 일', { startDate: createDateKey('2026-11-06'), localTime: null }, false],
      [
        '완료한 할 일',
        { startDate: createDateKey('2026-11-06'), localTime: '09:00', completed: true },
        false,
      ],
    ])('%s', (_name, overrides, expected) => {
      // Given
      const todos = [createParentTodo({ completed: false, ...overrides })];

      // When
      const result = TodoListPolicy.hasUpcomingTimedTodo(toList(todos), now);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('isLastOpenTodo — 아직 불러오지 않은 날', () => {
    it('목록을 불러오지 않았으면 다 끝낸 날이 아니다', () => {
      // When
      const result = TodoListPolicy.isLastOpenTodo(undefined, 1);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('groupByCategory', () => {
    it('할 일이 가진 카테고리로 묶고 카테고리 id 순으로 놓는다', () => {
      // Given
      const workout = { id: 7, name: '운동', color: '#51CF66' };
      const study = { id: 3, name: '공부', color: '#339AF0' };
      const run = createParentTodo({ id: 1, category: workout });
      const read = createParentTodo({ id: 2, category: study });
      const swim = createParentTodo({ id: 3, category: workout });

      // When
      const groups = TodoListPolicy.groupByCategory(toList([run, read, swim]));

      // Then
      expect(groups).toEqual([
        { category: study, todos: [read] },
        { category: workout, todos: [run, swim] },
      ]);
    });

    it('할 일이 없으면 묶음도 없다', () => {
      // When
      const groups = TodoListPolicy.groupByCategory(toList([]));

      // Then
      expect(groups).toEqual([]);
    });
  });

  describe('groupByCategories', () => {
    it('내 카테고리 순서대로 묶고 할 일이 없는 카테고리는 빈 묶음으로 둔다', () => {
      // Given
      const workout = createTodoCategoryWithCount({ id: 7, name: '운동', sortOrder: 0 });
      const study = createTodoCategoryWithCount({ id: 3, name: '공부', sortOrder: 1 });
      const run = createParentTodo({ id: 1, category: { id: 7, name: '운동', color: '#51CF66' } });
      const swim = createParentTodo({ id: 2, category: { id: 7, name: '운동', color: '#51CF66' } });

      // When
      const groups = TodoListPolicy.groupByCategories(toList([run, swim]), [workout, study]);

      // Then
      expect(groups).toEqual([
        { category: workout, todos: [run, swim] },
        { category: study, todos: [] },
      ]);
    });

    it('내 카테고리 목록에 없는 카테고리의 할 일은 어느 묶음에도 넣지 않는다', () => {
      // Given
      const workout = createTodoCategoryWithCount({ id: 7, name: '운동' });
      const orphan = createParentTodo({
        id: 1,
        category: { id: 9, name: '지운 곳', color: '#000000' },
      });

      // When
      const groups = TodoListPolicy.groupByCategories(toList([orphan]), [workout]);

      // Then
      expect(groups).toEqual([{ category: workout, todos: [] }]);
    });
  });

  describe('withTodoAdded', () => {
    it('더하면 끝에 붙고 원래 목록은 바뀌지 않는다', () => {
      // Given
      const list = toList([first]);

      // When
      const next = TodoListPolicy.withTodoAdded(list, second);

      // Then
      expect(next.todos.map((todo) => todo.id)).toEqual([1, 2]);
      expect(list.todos).toHaveLength(1);
    });
  });

  describe('withTodoRemoved', () => {
    it('지우면 그 할 일만 빠진다', () => {
      // Given
      const list = toList([first, second]);

      // When
      const removed = TodoListPolicy.withTodoRemoved(list, 1);

      // Then
      expect(removed.todos).toEqual([second]);
    });
  });

  describe('withTodoUpdated', () => {
    it('고치면 그 할 일만 바뀐다', () => {
      // Given
      const list = toList([first, second]);

      // When
      const updated = TodoListPolicy.withTodoUpdated(list, 2, (todo) => ({
        ...todo,
        completed: true,
      }));

      // Then
      expect(updated.todos[0]).toBe(first);
      expect(updated.todos[1]?.completed).toBe(true);
    });
  });

  describe('withTodoRestored', () => {
    it('되돌리면 빠진 할 일은 원래 자리로, 남은 할 일은 값만 돌아온다', () => {
      // Given
      const list = toList([second]);
      const changed = toList([{ ...first, completed: true }, second]);

      // When
      const reinserted = TodoListPolicy.withTodoRestored(list, { todo: first, index: 0 });
      const reverted = TodoListPolicy.withTodoRestored(changed, { todo: first, index: 0 });

      // Then
      expect(reinserted.todos).toEqual([first, second]);
      expect(reverted.todos).toEqual([first, second]);
    });
  });

  describe('withTodoSaved', () => {
    it.each([
      {
        title: '만들기 응답은 임시 행을 서버 행으로 바꾼다',
        todos: [first, createParentTodo({ id: -7 })],
        expectedIds: [1, 2],
      },
      {
        title: '응답 전에 다시 받아 임시 행이 사라졌으면 서버 행을 끝에 붙인다',
        todos: [first],
        expectedIds: [1, 2],
      },
      {
        title: '다시 받은 목록에 이미 서버 행이 있으면 한 번만 둔다',
        todos: [first, second],
        expectedIds: [1, 2],
      },
    ])('$title', ({ todos, expectedIds }) => {
      // Given
      const list = toList(todos);

      // When
      const next = TodoListPolicy.withTodoSaved(list, -7, second);

      // Then
      expect(next.todos.map((todo) => todo.id)).toEqual(expectedIds);
      expect(next.todos.at(-1)).toBe(second);
    });
  });
});
