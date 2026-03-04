import { z } from 'zod';

export const parseTodoRequestSchema = z.object({
  text: z
    .string()
    .min(1, '텍스트를 입력해주세요')
    .max(500, '텍스트는 500자 이하로 입력해주세요')
    .describe('AI로 파싱할 할 일 텍스트 (1-500자, 예: "내일 오후 3시 운동하기")'),
  categoryId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('카테고리 ID (프론트에서 선택한 카테고리, pass-through)'),
});

export type ParseTodoRequest = z.infer<typeof parseTodoRequestSchema>;
