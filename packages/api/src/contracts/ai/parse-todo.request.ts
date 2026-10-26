import { z } from "zod";

import { AI_PARSE_LIMITS } from "../../vocabulary/ai.constants.js";

export const parseTodoRequestSchema = z.object({
  text: z
    .string()
    .min(1, "텍스트를 입력해주세요")
    .max(
      AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH,
      `텍스트는 ${AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH}자 이하로 입력해주세요`,
    )
    .describe(
      `AI로 파싱할 할 일 텍스트 (1-${AI_PARSE_LIMITS.TODO_TEXT_MAX_LENGTH}자, 예: "내일 오후 3시 운동하기")`,
    ),
  categoryId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("카테고리 ID (프론트에서 선택한 카테고리, pass-through)"),
});

export type ParseTodoRequest = z.infer<typeof parseTodoRequestSchema>;
