import { createParentTodo, createSubTodo } from '../__tests__/sub-todo.fixtures';
import { SubTodoPolicy } from './sub-todo.model';

const createSubTodos = (count: number) =>
  Array.from({ length: count }, (_, index) => createSubTodo({ id: index + 1 }));

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

describe('withSubTodoCompleted', () => {
  it('서브투두를 완료하면 목록과 통계가 함께 바뀐다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1 }), createSubTodo({ id: 2 })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoCompleted(parentTodo, 1, true);

    // Then
    expect(result.subTodos.map((subTodo) => subTodo.completed)).toEqual([true, false]);
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
  });

  it('이미 완료한 서브투두를 다시 완료해도 1/1을 넘지 않는다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1, completed: true })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoCompleted(parentTodo, 1, true);

    // Then
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 1 });
  });
});

describe('withSubTodoAdded', () => {
  it('미완료 부모에 항목을 더하면 목록과 전체 개수가 늘고 완료 개수는 그대로다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1, completed: true })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

    // Then
    expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([1, 2]);
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
  });

  it('완료한 부모에 항목을 더하면 남은 일이 생겨 완료가 풀린다', () => {
    // Given
    const parentTodo = createParentTodo({
      completed: true,
      subTodos: [createSubTodo({ id: 1, completed: true })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

    // Then
    expect(result.completed).toBe(false);
  });

  it('미완료 부모에 항목을 더해도 미완료로 남는다', () => {
    // Given
    const parentTodo = createParentTodo({ completed: false });

    // When
    const result = SubTodoPolicy.withSubTodoAdded(parentTodo, createSubTodo({ id: 2 }));

    // Then
    expect(result.completed).toBe(false);
  });
});

describe('withSubTodoRemoved', () => {
  it('완료한 서브투두를 지우면 전체와 완료 개수가 함께 줄어든다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1, completed: true }), createSubTodo({ id: 2 })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoRemoved(parentTodo, 1);

    // Then
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 0 });
  });

  it('없는 서브투두를 지우려 하면 목록과 통계가 그대로다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1, completed: true })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoRemoved(parentTodo, 999);

    // Then
    expect(result.subTodos).toEqual(parentTodo.subTodos);
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 1, completed: 1 });
  });
});

describe('withSubTodoRenamed', () => {
  it('지정한 항목의 제목만 바뀌고 완료 상태와 통계는 그대로다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [
        createSubTodo({ id: 1, title: '장보기', completed: true }),
        createSubTodo({ id: 2, title: '청소' }),
      ],
    });

    // When
    const result = SubTodoPolicy.withSubTodoRenamed(parentTodo, 1, '장보기 끝');

    // Then
    expect(result.subTodos).toEqual([
      createSubTodo({ id: 1, title: '장보기 끝', completed: true }),
      createSubTodo({ id: 2, title: '청소' }),
    ]);
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 2, completed: 1 });
  });

  it('없는 항목의 제목을 바꾸려 하면 목록이 그대로다', () => {
    // Given
    const parentTodo = createParentTodo({
      subTodos: [createSubTodo({ id: 1, title: '장보기' })],
    });

    // When
    const result = SubTodoPolicy.withSubTodoRenamed(parentTodo, 999, '새 제목');

    // Then
    expect(result.subTodos).toEqual(parentTodo.subTodos);
  });
});

function createParentOf(subTodos: ReturnType<typeof createSubTodo>[]) {
  return createParentTodo({ subTodos });
}

describe('withSubTodoConfirmed', () => {
  it('임시 항목은 응답의 같은 제목 새 항목으로 바뀌고 진행 중인 다른 체크는 남는다', () => {
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
    const result = SubTodoPolicy.withSubTodoConfirmed(
      createParentOf([checked, optimistic]),
      -3,
      saved,
    );

    // Then
    expect(result.subTodos).toEqual([checked, createSubTodo({ id: 9, title: '새 항목' })]);
  });

  it('임시 항목이 이미 없으면 응답으로 다시 넣지 않는다', () => {
    // Given
    const todo = createParentOf([createSubTodo({ id: 9, title: '새 항목' })]);
    const saved = { subTodos: [createSubTodo({ id: 9, title: '새 항목' })] };

    // When
    const result = SubTodoPolicy.withSubTodoConfirmed(todo, -3, saved);

    // Then
    expect(result).toBe(todo);
  });
});

describe('withSubTodoRestored', () => {
  it('지운 항목은 원래 자리로 돌아오고 숫자도 다시 계산한다', () => {
    // Given
    const removed = createSubTodo({ id: 6, completed: true });
    const todo = createParentOf([createSubTodo({ id: 5 }), createSubTodo({ id: 7 })]);

    // When
    const result = SubTodoPolicy.withSubTodoRestored(todo, removed, 1);

    // Then
    expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([5, 6, 7]);
    expect(SubTodoPolicy.getSubTodoStats(result.subTodos)).toEqual({ total: 3, completed: 1 });
  });

  it('같은 id의 항목이 이미 있으면 다시 넣지 않는다', () => {
    // Given
    const todo = createParentOf([createSubTodo({ id: 5 })]);

    // When
    const result = SubTodoPolicy.withSubTodoRestored(todo, createSubTodo({ id: 5 }), 0);

    // Then
    expect(result).toBe(todo);
  });
});

describe('withSubTodosOrdered', () => {
  it('순서를 정한 뒤 더한 항목은 사라지지 않고 뒤에 남는다', () => {
    // Given
    const todo = createParentOf([
      createSubTodo({ id: 5 }),
      createSubTodo({ id: 6 }),
      createSubTodo({ id: -1 }),
    ]);

    // When
    const result = SubTodoPolicy.withSubTodosOrdered(todo, [6, 5]);

    // Then
    expect(result.subTodos.map((subTodo) => subTodo.id)).toEqual([6, 5, -1]);
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
    const changed = SubTodoPolicy.hasTitleChanged(createSubTodo({ title: '장보기' }), '장보기 끝');

    // Then
    expect(same).toBe(false);
    expect(changed).toBe(true);
  });
});
