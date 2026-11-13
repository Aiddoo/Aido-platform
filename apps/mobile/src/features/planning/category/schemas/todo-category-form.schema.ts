import { createTodoCategorySchema } from '@aido/api';
import type { z } from 'zod';

import { DEFAULT_CATEGORY_COLOR } from '../constants/todo-category.constants';

/** 만들기와 고치기의 입력 규칙. 이름 길이와 색 형식은 서버 계약과 같은 값을 쓴다 */
export const todoCategoryFormSchema = createTodoCategorySchema.pick({ name: true, color: true });
export type TodoCategoryFormValues = z.infer<typeof todoCategoryFormSchema>;

export const TODO_CATEGORY_FORM_DEFAULT_VALUES: TodoCategoryFormValues = {
  name: '',
  color: DEFAULT_CATEGORY_COLOR,
};
