import type { TodoCategory } from '@src/features/planning/category/domains/todo-category.model';
import type { DateKey } from '@src/shared/date/date-key';
import { groupBy } from 'es-toolkit';
import { z } from 'zod';

import { type Todo, TodoPolicy, todoSchema } from './todo.model';

// 하루(또는 기간)의 할 일 목록. hasNext면 서버 한도에서 잘려 목록만으로 그날을 다 알 수 없다
export const todoListResultSchema = z.object({
  todos: z.array(todoSchema),
  hasNext: z.boolean(),
  nextCursor: z.int().nullable(),
});
export type TodoListResult = z.infer<typeof todoListResultSchema>;

export interface TodoCategoryGroup<TCategory> {
  category: TCategory;
  todos: Todo[];
}

/** 벽시계로 본 지금. 시각은 어디서든 그 시각이라 벽시계로 비교한다 */
interface WallClockNow {
  dateKey: DateKey;
  time: string;
  timezone: string;
}

/** 되돌릴 할 일과 그 할 일이 있던 자리 */
interface RemovedTodo {
  todo: Todo;
  index: number;
}

function groupTodosByCategoryId(todos: readonly Todo[]) {
  return groupBy(todos, (todo) => todo.category.id);
}

export const TodoListPolicy = {
  // 시트 route의 대상 할 일. 목록에서 사라졌으면(삭제·다른 날짜) null
  findTodo(list: TodoListResult, todoId: number): Todo | null {
    return list.todos.find((todo) => todo.id === todoId) ?? null;
  },

  // 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다. 여러 날 할 일은 시작일 목록만 낙관적으로 바뀌어 끝낸 것은 완료로 본다.
  // 아직 불러오지 않은 날(undefined)은 다 끝낸 날이 아니다
  isLastOpenTodo(list: TodoListResult | undefined, completedTodoId: number): boolean {
    return (
      list != null &&
      list.todos.some((todo) => todo.id === completedTodoId) &&
      list.todos.every((todo) => todo.id === completedTodoId || todo.completed)
    );
  },

  // 완료 전이고 시간이 있으며 아직 지나지 않은 할 일이 있는가
  hasUpcomingTimedTodo(list: TodoListResult, now: WallClockNow): boolean {
    return list.todos.some((todo) => {
      const localTime = TodoPolicy.findLocalTime(todo, now.timezone);
      return (
        !todo.completed &&
        localTime != null &&
        (todo.startDate > now.dateKey || (todo.startDate === now.dateKey && localTime > now.time))
      );
    });
  },

  // 친구의 카테고리 목록은 받지 않아 할 일이 가진 카테고리로 묶는다. 할 일이 있는 카테고리만 나온다
  groupByCategory(list: TodoListResult): TodoCategoryGroup<Todo['category']>[] {
    return Object.values(groupTodosByCategoryId(list.todos)).flatMap((todos) => {
      const [first] = todos;
      return first == null ? [] : [{ category: first.category, todos }];
    });
  },

  // 내 카테고리 순서대로 묶는다. 할 일이 없는 카테고리도 빈 묶음으로 남아 그 카테고리에 바로 더할 수 있다
  groupByCategories<TCategory extends TodoCategory>(
    list: TodoListResult,
    categories: readonly TCategory[],
  ): TodoCategoryGroup<TCategory>[] {
    const grouped = groupTodosByCategoryId(list.todos);
    return categories.map((category) => ({ category, todos: grouped[category.id] ?? [] }));
  },

  withTodoAdded(list: TodoListResult, todo: Todo): TodoListResult {
    return { ...list, todos: [...list.todos, todo] };
  },

  withTodoRemoved(list: TodoListResult, todoId: number): TodoListResult {
    return { ...list, todos: list.todos.filter((todo) => todo.id !== todoId) };
  },

  withTodoUpdated(
    list: TodoListResult,
    todoId: number,
    update: (todo: Todo) => Todo,
  ): TodoListResult {
    return { ...list, todos: list.todos.map((todo) => (todo.id === todoId ? update(todo) : todo)) };
  },

  // 그 할 일 하나만 되돌린다. 아직 목록에 있으면 값만, 빠졌으면 원래 자리에 넣어 같은 날짜의 다른 변경은 지킨다
  withTodoRestored(list: TodoListResult, removed: RemovedTodo): TodoListResult {
    if (list.todos.some((todo) => todo.id === removed.todo.id)) {
      return this.withTodoUpdated(list, removed.todo.id, () => removed.todo);
    }
    return {
      ...list,
      todos: [
        ...list.todos.slice(0, removed.index),
        removed.todo,
        ...list.todos.slice(removed.index),
      ],
    };
  },

  // 만든 할 일 응답으로 임시 행을 바꾼다. 그사이 다시 받아 임시 행이 사라졌으면 서버 행이 없을 때만 끝에 붙인다
  withTodoSaved(list: TodoListResult, optimisticId: number, saved: Todo): TodoListResult {
    if (list.todos.some((todo) => todo.id === optimisticId)) {
      return this.withTodoUpdated(list, optimisticId, () => saved);
    }
    if (list.todos.some((todo) => todo.id === saved.id)) {
      return list;
    }
    return this.withTodoAdded(list, saved);
  },
};
