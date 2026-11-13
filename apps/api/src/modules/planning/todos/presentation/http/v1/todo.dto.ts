import {
  changeTodoCategorySchema,
  createRecurringTodoResponseSchema,
  createRecurringTodoSchema,
  createTodoItemSchema,
  createTodoResponseSchema,
  createTodoSchema,
  deleteTodoQuerySchema,
  deleteTodoResponseSchema,
  friendTodoListResponseSchema,
  getTodoSummaryQuerySchema,
  getTodosQuerySchema,
  reorderTodoItemsSchema,
  reorderTodoResponseSchema,
  reorderTodoSchema,
  todoIdParamSchema,
  todoItemIdParamSchema,
  todoListResponseSchema,
  todoOverviewResponseSchema,
  todoResourceLimitQuerySchema,
  todoResourceLimitResponseSchema,
  todoSchema,
  todoSummaryResponseSchema,
  toggleTodoCompleteSchema,
  updateTodoItemSchema,
  updateTodoResponseSchema,
  updateTodoScheduleSchema,
  updateTodoSchema,
  updateTodoTitleSchema,
  updateTodoVisibilitySchema,
} from "@aido/api";
import type { z } from "zod";

export const ChangeTodoCategoryDto = changeTodoCategorySchema.meta({ id: "ChangeTodoCategoryDto" });
export type ChangeTodoCategoryDto = z.infer<typeof ChangeTodoCategoryDto>;

export const CreateRecurringTodoDto = createRecurringTodoSchema.meta({
  id: "CreateRecurringTodoDto",
});
export type CreateRecurringTodoDto = z.infer<typeof CreateRecurringTodoDto>;

export const CreateTodoItemDto = createTodoItemSchema.meta({ id: "CreateTodoItemDto" });
export type CreateTodoItemDto = z.infer<typeof CreateTodoItemDto>;

export const CreateTodoDto = createTodoSchema.meta({ id: "CreateTodoDto" });
export type CreateTodoDto = z.infer<typeof CreateTodoDto>;

export const DeleteTodoQueryDto = deleteTodoQuerySchema.meta({
  id: "DeleteTodoQueryDto",
  apiParameter: true,
});
export type DeleteTodoQueryDto = z.infer<typeof DeleteTodoQueryDto>;

const getFriendTodosQuerySchema = getTodosQuerySchema.pick({
  cursor: true,
  size: true,
  startDate: true,
  endDate: true,
});

export const GetFriendTodosQueryDto = getFriendTodosQuerySchema.meta({
  id: "GetFriendTodosQueryDto",
  apiParameter: true,
});
export type GetFriendTodosQueryDto = z.infer<typeof GetFriendTodosQueryDto>;

export const GetTodosQueryDto = getTodosQuerySchema.meta({
  id: "GetTodosQueryDto",
  apiParameter: true,
});
export type GetTodosQueryDto = z.infer<typeof GetTodosQueryDto>;

export const ReorderTodoItemsDto = reorderTodoItemsSchema.meta({ id: "ReorderTodoItemsDto" });
export type ReorderTodoItemsDto = z.infer<typeof ReorderTodoItemsDto>;

export const ReorderTodoDto = reorderTodoSchema.meta({ id: "ReorderTodoDto" });
export type ReorderTodoDto = z.infer<typeof ReorderTodoDto>;

export const TodoIdParamDto = todoIdParamSchema.meta({ id: "TodoIdParamDto", apiParameter: true });
export type TodoIdParamDto = z.infer<typeof TodoIdParamDto>;

export const TodoItemIdParamDto = todoItemIdParamSchema.meta({
  id: "TodoItemIdParamDto",
  apiParameter: true,
});
export type TodoItemIdParamDto = z.infer<typeof TodoItemIdParamDto>;

export const TodoResourceLimitQueryDto = todoResourceLimitQuerySchema.meta({
  id: "TodoResourceLimitQueryDto",
  apiParameter: true,
});
export type TodoResourceLimitQueryDto = z.infer<typeof TodoResourceLimitQueryDto>;

export const TodoSummaryQueryDto = getTodoSummaryQuerySchema.meta({
  id: "TodoSummaryQueryDto",
  apiParameter: true,
});
export type TodoSummaryQueryDto = z.infer<typeof TodoSummaryQueryDto>;

export const ToggleTodoCompleteDto = toggleTodoCompleteSchema.meta({ id: "ToggleTodoCompleteDto" });
export type ToggleTodoCompleteDto = z.infer<typeof ToggleTodoCompleteDto>;

export const UpdateTodoScheduleDto = updateTodoScheduleSchema.meta({ id: "UpdateTodoScheduleDto" });
export type UpdateTodoScheduleDto = z.infer<typeof UpdateTodoScheduleDto>;

export const UpdateTodoTitleDto = updateTodoTitleSchema.meta({ id: "UpdateTodoTitleDto" });
export type UpdateTodoTitleDto = z.infer<typeof UpdateTodoTitleDto>;

export const UpdateTodoItemDto = updateTodoItemSchema.meta({ id: "UpdateTodoItemDto" });
export type UpdateTodoItemDto = z.infer<typeof UpdateTodoItemDto>;

export const UpdateTodoDto = updateTodoSchema.meta({ id: "UpdateTodoDto" });
export type UpdateTodoDto = z.infer<typeof UpdateTodoDto>;

export const UpdateTodoVisibilityDto = updateTodoVisibilitySchema.meta({
  id: "UpdateTodoVisibilityDto",
});
export type UpdateTodoVisibilityDto = z.infer<typeof UpdateTodoVisibilityDto>;

export const TodoResponseDto = todoSchema.meta({ id: "TodoResponseDto" });
export type TodoResponseDto = z.infer<typeof TodoResponseDto>;
export const TodoListResponseDto = todoListResponseSchema.meta({ id: "TodoListResponseDto" });
export type TodoListResponseDto = z.infer<typeof TodoListResponseDto>;
export const FriendTodoListResponseDto = friendTodoListResponseSchema.meta({
  id: "FriendTodoListResponseDto",
});
export type FriendTodoListResponseDto = z.infer<typeof FriendTodoListResponseDto>;
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
export const TodoOverviewResponseDto = todoOverviewResponseSchema.meta({
  id: "TodoOverviewResponseDto",
});
export type TodoOverviewResponseDto = z.infer<typeof TodoOverviewResponseDto>;
