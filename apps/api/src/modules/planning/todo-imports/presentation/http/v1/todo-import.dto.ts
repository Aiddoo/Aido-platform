import {
  activeTodoImportResponseSchema,
  receiveTodoImportItemsRequestSchema,
  receiveTodoImportItemsResponseSchema,
  startTodoImportRequestSchema,
  todoImportIdParamSchema,
  todoImportResponseSchema,
} from "@aido/api/contracts/todo-import/v1";
import type { z } from "zod";

export const StartTodoImportDto = startTodoImportRequestSchema.meta({ id: "StartTodoImportDto" });
export type StartTodoImportDto = z.infer<typeof StartTodoImportDto>;
export const ReceiveTodoImportItemsDto = receiveTodoImportItemsRequestSchema.meta({
  id: "ReceiveTodoImportItemsDto",
});
export type ReceiveTodoImportItemsDto = z.infer<typeof ReceiveTodoImportItemsDto>;
export const TodoImportIdParamDto = todoImportIdParamSchema.meta({
  id: "TodoImportIdParamDto",
  apiParameter: true,
});
export type TodoImportIdParamDto = z.infer<typeof TodoImportIdParamDto>;

export const TodoImportResponseDto = todoImportResponseSchema.meta({
  id: "TodoImportResponseDto",
});
export type TodoImportResponseDto = z.infer<typeof TodoImportResponseDto>;
export const ActiveTodoImportResponseDto = activeTodoImportResponseSchema.meta({
  id: "ActiveTodoImportResponseDto",
});
export type ActiveTodoImportResponseDto = z.infer<typeof ActiveTodoImportResponseDto>;
export const ReceiveTodoImportItemsResponseDto = receiveTodoImportItemsResponseSchema.meta({
  id: "ReceiveTodoImportItemsResponseDto",
});
export type ReceiveTodoImportItemsResponseDto = z.infer<typeof ReceiveTodoImportItemsResponseDto>;
