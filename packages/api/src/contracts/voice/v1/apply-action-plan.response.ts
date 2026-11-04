import { z } from "zod";

import { memoSchema } from "../../memo/v1/memo.response.js";
import { todoSchema } from "../../todo/v1/todo.response.js";

export const applyActionPlanResponseSchema = z.object({
  todos: z.array(todoSchema).describe("저장한 할 일 (반복이면 만든 회차 전부)"),
  memo: memoSchema.nullable().describe("저장한 메모. 없으면 null"),
});

export type ApplyActionPlanResponse = z.infer<typeof applyActionPlanResponseSchema>;
