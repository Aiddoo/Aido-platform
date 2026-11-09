import { createTodoCategorySchema } from '@aido/api';
import type { z } from 'zod';

/** 만들기와 고치기의 입력 규칙. 이름 길이와 색 형식은 서버 계약과 같은 값을 쓴다 */
export const todoCategoryFormSchema = createTodoCategorySchema.pick({ name: true, color: true });
export type TodoCategoryFormValues = z.infer<typeof todoCategoryFormSchema>;
