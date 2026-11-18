import {
  todoCommentIdParamSchema,
  todoDetailsParamSchema,
} from "@aido/api/contracts/todo-comment/v1";
import type { z } from "zod";

// v1·v2 경로가 같은 경로 변수를 받아 버전 밖에 둔다. component id는 출시 OpenAPI 계약이다
export const TodoDetailsParamDto = todoDetailsParamSchema.meta({
  id: "TodoDetailsParamDto",
  apiParameter: true,
});
export type TodoDetailsParamDto = z.infer<typeof TodoDetailsParamDto>;
export const TodoCommentIdParamDto = todoCommentIdParamSchema.meta({
  id: "TodoCommentIdParamDto",
  apiParameter: true,
});
export type TodoCommentIdParamDto = z.infer<typeof TodoCommentIdParamDto>;
