import type { TodoCategory } from '../domains/todo-category.model';
import type { TodoCategoryFormValues } from '../schemas/todo-category-form.schema';

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
