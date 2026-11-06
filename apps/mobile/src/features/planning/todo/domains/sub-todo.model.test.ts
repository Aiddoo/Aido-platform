import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.fixtures';
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

  describe('withSubTodoToggled', () => {
    test('서브투두를 완료하면 목록과 통계가 함께 바뀐다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1 }), createSubTodo({ id: 2 })],
        subTodoStats: { total: 2, completed: 0 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoToggled(parentTodo, 1, true);

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.completed)).toEqual([true, false]);
      expect(result.subTodoStats).toEqual({ total: 2, completed: 1 });
    });

    test('이미 완료한 서브투두를 다시 완료해도 1/1을 넘지 않는다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
        subTodoStats: { total: 1, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoToggled(parentTodo, 1, true);

      // Then
      expect(result.subTodoStats).toEqual({ total: 1, completed: 1 });
    });

    test('캐시의 통계가 목록과 어긋나 있어도 목록 기준으로 바로잡는다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1 })],
        subTodoStats: { total: 1, completed: 2 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoToggled(parentTodo, 1, false);

      // Then
      expect(result.subTodoStats).toEqual({ total: 1, completed: 0 });
    });
  });

  describe('withSubTodoAdded', () => {
    test('서브투두를 추가하면 전체 개수만 늘어난다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
        subTodoStats: { total: 1, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([1, 2]);
      expect(result.subTodoStats).toEqual({ total: 2, completed: 1 });
    });
  });

  describe('withSubTodoRemoved', () => {
    test('완료한 서브투두를 지우면 전체와 완료 개수가 함께 줄어든다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true }), createSubTodo({ id: 2 })],
        subTodoStats: { total: 2, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoRemoved(parentTodo, 1);

      // Then
      expect(result.subTodoStats).toEqual({ total: 1, completed: 0 });
    });

    test('없는 서브투두를 지우려 하면 목록과 통계가 그대로다', () => {
      // Given
      const parentTodo = createParentTodo({
        subTodos: [createSubTodo({ id: 1, completed: true })],
        subTodoStats: { total: 1, completed: 1 },
      });

      // When
      const result = SubTodoPolicy.withSubTodoRemoved(parentTodo, 999);

      // Then
      expect(result.subTodos).toEqual(parentTodo.subTodos);
      expect(result.subTodoStats).toEqual({ total: 1, completed: 1 });
    });
  });

  describe('getSubTodoCompletionProgress', () => {
    test('서브투두가 없으면 0을 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 0, completed: 0 } });

      // When
      const result = SubTodoPolicy.getSubTodoCompletionProgress(parentTodo);

      // Then
      expect(result).toBe(0);
    });

    test('2/5 완료이면 0.4를 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 5, completed: 2 } });

      // When
      const result = SubTodoPolicy.getSubTodoCompletionProgress(parentTodo);

      // Then
      expect(result).toBe(0.4);
    });

    test('전부 완료이면 1을 반환한다', () => {
      // Given
      const parentTodo = createParentTodo({ subTodoStats: { total: 3, completed: 3 } });

      // When
      const result = SubTodoPolicy.getSubTodoCompletionProgress(parentTodo);

      // Then
      expect(result).toBe(1);
    });
  });

  describe('낙관적 갱신 되돌리기와 확정', () => {
    const parent = (subTodos: ReturnType<typeof createSubTodo>[]) =>
      createParentTodo({
        subTodos,
        subTodoStats: {
          total: subTodos.length,
          completed: subTodos.filter((subTodo) => subTodo.completed).length,
        },
      });

    test('임시 항목은 응답의 같은 제목 새 항목으로 바뀌고 진행 중인 다른 체크는 남는다', () => {
      // Given
      const optimistic = createSubTodo({ id: -3, title: '새 항목' });
      const checked = createSubTodo({ id: 5, title: '기존', completed: true });
      const saved = {
        subTodos: [
          createSubTodo({ id: 5, title: '기존', completed: false }),
          createSubTodo({ id: 9, title: '새 항목' }),
        ],
      };

      // When
      const result = SubTodoPolicy.withSubTodoConfirmed(parent([checked, optimistic]), -3, saved);

      // Then
      expect(result.subTodos).toEqual([checked, createSubTodo({ id: 9, title: '새 항목' })]);
    });

    test('임시 항목이 이미 없으면 응답으로 다시 넣지 않는다', () => {
      // Given
      const todo = parent([createSubTodo({ id: 9, title: '새 항목' })]);

      // When
      const result = SubTodoPolicy.withSubTodoConfirmed(todo, -3, {
        subTodos: [createSubTodo({ id: 9, title: '새 항목' })],
      });

      // Then
      expect(result).toBe(todo);
    });

    test('지운 항목은 원래 자리로 돌아오고 숫자도 다시 계산한다', () => {
      // Given
      const removed = createSubTodo({ id: 6, completed: true });
      const todo = parent([createSubTodo({ id: 5 }), createSubTodo({ id: 7 })]);

      // When
      const result = SubTodoPolicy.withSubTodoRestored(todo, removed, 1);

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([5, 6, 7]);
      expect(result.subTodoStats).toEqual({ total: 3, completed: 1 });
    });

    test('순서를 정한 뒤 더한 항목은 사라지지 않고 뒤에 남는다', () => {
      // Given
      const todo = parent([
        createSubTodo({ id: 5 }),
        createSubTodo({ id: 6 }),
        createSubTodo({ id: -1 }),
      ]);

      // When
      const result = SubTodoPolicy.withSubTodosOrdered(todo, [6, 5]);

      // Then
      expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([6, 5, -1]);
    });

    test('임시 id는 음수다', () => {
      expect(SubTodoPolicy.isOptimisticSubTodo(createSubTodo({ id: -1 }))).toBe(true);
      expect(SubTodoPolicy.isOptimisticSubTodo(createSubTodo({ id: 1 }))).toBe(false);
    });
  });
});

describe('SubTodoPolicy.hasTitleChanged', () => {
  it('제목이 그대로면 바뀐 값이 없다', () => {
    // When
    const same = SubTodoPolicy.hasTitleChanged({ title: '장보기' }, '장보기');
    const changed = SubTodoPolicy.hasTitleChanged({ title: '장보기' }, '장보기 끝');

    // Then
    expect(same).toBe(false);
    expect(changed).toBe(true);
  });
});
