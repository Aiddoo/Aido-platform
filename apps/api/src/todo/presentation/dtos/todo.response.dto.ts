import {
  createRecurringTodoResponseSchema,
  createTodoResponseSchema,
  deleteTodoResponseSchema,
  reorderTodoResponseSchema,
  todoListResponseSchema,
  todoResourceLimitResponseSchema,
  todoSchema,
  todoSummaryResponseSchema,
  updateTodoResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const TodoResponseDto = todoSchema.meta({ id: "TodoResponseDto" });
export type TodoResponseDto = z.infer<typeof TodoResponseDto>;
export const TodoListResponseDto = todoListResponseSchema.meta({ id: "TodoListResponseDto" });
export type TodoListResponseDto = z.infer<typeof TodoListResponseDto>;
export const CreateTodoResponseDto = createTodoResponseSchema.meta({ id: "CreateTodoResponseDto" });
export type CreateTodoResponseDto = z.infer<typeof CreateTodoResponseDto>;
export const CreateRecurringTodoResponseDto = createRecurringTodoResponseSchema.meta({
  id: "CreateRecurringTodoResponseDto",
});
export type CreateRecurringTodoResponseDto = z.infer<typeof CreateRecurringTodoResponseDto>;
export const UpdateTodoResponseDto = updateTodoResponseSchema.meta({ id: "UpdateTodoResponseDto" });
export type UpdateTodoResponseDto = z.infer<typeof UpdateTodoResponseDto>;
export const DeleteTodoResponseDto = deleteTodoResponseSchema.meta({ id: "DeleteTodoResponseDto" });
export type DeleteTodoResponseDto = z.infer<typeof DeleteTodoResponseDto>;
export const ReorderTodoResponseDto = reorderTodoResponseSchema.meta({
  id: "ReorderTodoResponseDto",
});
export type ReorderTodoResponseDto = z.infer<typeof ReorderTodoResponseDto>;
export const TodoResourceLimitResponseDto = todoResourceLimitResponseSchema.meta({
  id: "TodoResourceLimitResponseDto",
});
export type TodoResourceLimitResponseDto = z.infer<typeof TodoResourceLimitResponseDto>;
export const TodoSummaryResponseDto = todoSummaryResponseSchema.meta({
  id: "TodoSummaryResponseDto",
});
export type TodoSummaryResponseDto = z.infer<typeof TodoSummaryResponseDto>;
