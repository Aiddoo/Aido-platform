import type { TodoCategory, TodoCategoryDeletionRequest } from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';

export type TodoCountBucket = '0' | '1_9' | '10_49' | '50_plus';
export type CategoryDeletedTodoHandling = 'move' | 'delete' | 'empty';

const TODO_COUNT_BUCKET_START = { tens: 10, fifties: 50 } as const;

/** category_updated 지표의 field. 색이 달라졌으면 color, 아니면 name. 기존 값을 모르면 요청에 담긴 색을 바뀐 것으로 본다 */
export function getCategoryUpdatedField(
  category: Pick<TodoCategory, 'color'> | null,
  change: Partial<Pick<TodoCategoryFormValues, 'color'>>,
): 'name' | 'color' {
  if (change.color == null) {
    return 'name';
  }

  return category?.color === change.color ? 'name' : 'color';
}

/** 할 일 수는 정확한 값 대신 구간으로만 남긴다 */
export function toTodoCountBucket(todoCount: number): TodoCountBucket {
  if (todoCount <= 0) {
    return '0';
  }
  if (todoCount < TODO_COUNT_BUCKET_START.tens) {
    return '1_9';
  }

  return todoCount < TODO_COUNT_BUCKET_START.fifties ? '10_49' : '50_plus';
}

/** 처리 방식 없이 옮길 곳만 보낸 옛 서버의 삭제도 move로 센다 */
export function getCategoryDeletedTodoHandling(
  deletion: TodoCategoryDeletionRequest,
): CategoryDeletedTodoHandling {
  if (deletion.todoHandling != null) {
    return deletion.todoHandling;
  }

  return deletion.moveToCategoryId == null ? 'empty' : 'move';
}
