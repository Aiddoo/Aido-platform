import { range } from 'es-toolkit';

import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.fixtures';
import { SubTodoPolicy } from './sub-todo.model';

function createSubTodos(count: number) {
  return range(count).map((index) => createSubTodo({ id: index + 1 }));
}

describe('SubTodoPolicy', () => {
  describe('getSubTodoStats', () => {
    it('진행 숫자는 항목 목록에서 센다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [
          createSubTodo({ id: 1, completed: true }),
          createSubTodo({ id: 2 }),
          createSubTodo({ id: 3, completed: true }),
          createSubTodo({ id: 4 }),
        ],
      });

      // When
      const stats = SubTodoPolicy.getSubTodoStats(parentTodo.subTodos);

      // Then
      expect(stats).toEqual({ total: 4, completed: 2 });
    });

    it.each([
      { count: 0, expected: false },
      { count: 1, expected: true },
    ])('항목이 $count개면 진행 막대를 보일지는 $expected다', ({ count, expected }) => {
      // Given
      const parentTodo = createParentTodo({ subTodos: createSubTodos(count) });

      // When
      const result = SubTodoPolicy.hasSubTodos(parentTodo.subTodos);

      // Then
      expect(result).toBe(expected);
    });
  });

  describe('canAddSubTodo', () => {
    it('서브투두가 0개이면 추가할 수 있다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodos: createSubTodos(0) });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo.subTodos);

      // Then
      expect(result).toBe(true);
    });

    it('서브투두가 19개이면 추가할 수 있다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodos: createSubTodos(19) });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo.subTodos);

      // Then
      expect(result).toBe(true);
    });

    it('서브투두가 20개이면 추가할 수 없다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodos: createSubTodos(20) });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo.subTodos);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isOptimisticSubTodo', () => {
    it('id가 음수이면 임시 항목이다', () => {
      // When
      const optimistic = SubTodoPolicy.isOptimisticSubTodo(createSubTodo({ id: -1 }));
      const saved = SubTodoPolicy.isOptimisticSubTodo(createSubTodo({ id: 1 }));

      // Then
      expect(optimistic).toBe(true);
      expect(saved).toBe(false);
    });
  });

  describe('hasTitleChanged', () => {
    it('제목이 그대로면 바뀐 값이 없다', () => {
      // When
      const same = SubTodoPolicy.hasTitleChanged(createSubTodo({ title: '장보기' }), '장보기');
      const changed = SubTodoPolicy.hasTitleChanged(
        createSubTodo({ title: '장보기' }),
        '장보기 끝',
      );

      // Then
      expect(same).toBe(false);
      expect(changed).toBe(true);
    });
  });
});
