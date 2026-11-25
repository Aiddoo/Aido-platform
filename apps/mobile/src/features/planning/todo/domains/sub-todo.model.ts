import { TODO_ITEM_LIMITS } from '@aido/api/vocabulary';
import { isOptimisticId } from '@src/shared/domains/optimistic-id.model';
import { z } from 'zod';

// 항목을 더하고 지우고 고치는 규칙은 항목을 가진 할 일의 것이라 TodoPolicy에 있다
export const subTodoSchema = z.object({
  id: z.int(),
  title: z.string(),
  completed: z.boolean(),
  sortOrder: z.int(),
});
export type SubTodo = z.infer<typeof subTodoSchema>;

/** 진행 막대·"2/4" 숫자. 서버 itemStats도 items에서 계산해 앱은 항목 목록 하나만 둔다 */
interface SubTodoStats {
  total: number;
  completed: number;
}

export const SubTodoPolicy = {
  // 임시 항목은 체크·수정·순서 변경 요청을 보낼 수 없다
  isOptimisticSubTodo(subTodo: SubTodo): boolean {
    return isOptimisticId(subTodo.id);
  },

  // 목록에서만 계산한다. 숫자를 따로 두고 ±1 하면 같은 변경이 두 번 들어올 때 1/1이 2/1처럼 어긋난다
  getSubTodoStats(subTodos: readonly SubTodo[]): SubTodoStats {
    return {
      total: subTodos.length,
      completed: subTodos.filter((subTodo) => subTodo.completed).length,
    };
  },

  hasSubTodos(subTodos: readonly SubTodo[]): boolean {
    return subTodos.length > 0;
  },

  canAddSubTodo(subTodos: readonly SubTodo[]): boolean {
    return subTodos.length < TODO_ITEM_LIMITS.MAX_PER_TODO;
  },

  // 제목이 그대로면 요청을 보내지 않는다
  hasTitleChanged(subTodo: SubTodo, title: string): boolean {
    return subTodo.title !== title;
  },
};
