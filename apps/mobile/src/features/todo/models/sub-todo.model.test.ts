import { createParentTodo } from '../__tests__/sub-todo.factories';
import { SubTodoPolicy } from './sub-todo.model';

describe('SubTodoPolicy', () => {
  describe('canAddSubTodo', () => {
    test('서브투두가 0개이면 추가할 수 있다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 0, completed: 0 } });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo);

      // Then
      expect(result).toBe(true);
    });

    test('서브투두가 19개이면 추가할 수 있다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 19, completed: 0 } });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo);

      // Then
      expect(result).toBe(true);
    });

    test('서브투두가 20개이면 추가할 수 없다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 20, completed: 5 } });

      // When
      const result = SubTodoPolicy.canAddSubTodo(parentTodo);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('statsAfterToggle', () => {
    test('완료로 토글하면 completed가 1 증가한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 5, completed: 2 } });

      // When
      const result = SubTodoPolicy.statsAfterToggle(parentTodo, true);

      // Then
      expect(result).toEqual({ total: 5, completed: 3 });
    });

    test('미완료로 토글하면 completed가 1 감소한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 5, completed: 2 } });

      // When
      const result = SubTodoPolicy.statsAfterToggle(parentTodo, false);

      // Then
      expect(result).toEqual({ total: 5, completed: 1 });
    });
  });

  describe('statsAfterAdd', () => {
    test('추가하면 total이 1 증가하고 completed는 유지된다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 3, completed: 1 } });

      // When
      const result = SubTodoPolicy.statsAfterAdd(parentTodo);

      // Then
      expect(result).toEqual({ total: 4, completed: 1 });
    });
  });

  describe('statsAfterDelete', () => {
    test('완료된 서브투두를 삭제하면 total과 completed가 각각 1 감소한다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [
          { id: 1, title: '완료 항목', completed: true, sortOrder: 0 },
          { id: 2, title: '미완료 항목', completed: false, sortOrder: 1 },
        ],
        subTodoStats: { total: 2, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.statsAfterDelete(parentTodo, 1);

      // Then
      expect(result).toEqual({ total: 1, completed: 0 });
    });

    test('미완료 서브투두를 삭제하면 total만 1 감소한다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [
          { id: 1, title: '완료 항목', completed: true, sortOrder: 0 },
          { id: 2, title: '미완료 항목', completed: false, sortOrder: 1 },
        ],
        subTodoStats: { total: 2, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.statsAfterDelete(parentTodo, 2);

      // Then
      expect(result).toEqual({ total: 1, completed: 1 });
    });

    test('존재하지 않는 id를 삭제하면 미완료로 취급하여 total만 1 감소한다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [{ id: 1, title: '항목', completed: true, sortOrder: 0 }],
        subTodoStats: { total: 1, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.statsAfterDelete(parentTodo, 999);

      // Then
      expect(result).toEqual({ total: 0, completed: 1 });
    });
  });

  describe('completionProgress', () => {
    test('서브투두가 없으면 0을 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 0, completed: 0 } });

      // When
      const result = SubTodoPolicy.completionProgress(parentTodo);

      // Then
      expect(result).toBe(0);
    });

    test('2/5 완료이면 0.4를 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 5, completed: 2 } });

      // When
      const result = SubTodoPolicy.completionProgress(parentTodo);

      // Then
      expect(result).toBe(0.4);
    });

    test('전부 완료이면 1을 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 3, completed: 3 } });

      // When
      const result = SubTodoPolicy.completionProgress(parentTodo);

      // Then
      expect(result).toBe(1);
    });
  });
});
