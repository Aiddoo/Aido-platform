import { AddTodoItemHandler } from "./add-todo-item/add-todo-item.handler";
import { ChangeTodoCategoryHandler } from "./change-todo-category/change-todo-category.handler";
import { CreateRecurringTodosHandler } from "./create-recurring-todos/create-recurring-todos.handler";
import { CreateTodoHandler } from "./create-todo/create-todo.handler";
import { DeleteTodoHandler } from "./delete-todo/delete-todo.handler";
import { DeleteTodoItemHandler } from "./delete-todo-item/delete-todo-item.handler";
import { ReorderTodoHandler } from "./reorder-todo/reorder-todo.handler";
import { ReorderTodoItemsHandler } from "./reorder-todo-items/reorder-todo-items.handler";
import { ToggleTodoCompleteHandler } from "./toggle-todo-complete/toggle-todo-complete.handler";
import { UpdateTodoHandler } from "./update-todo/update-todo.handler";
import { UpdateTodoItemHandler } from "./update-todo-item/update-todo-item.handler";
import { UpdateTodoScheduleHandler } from "./update-todo-schedule/update-todo-schedule.handler";
import { UpdateTodoTitleHandler } from "./update-todo-title/update-todo-title.handler";
import { UpdateTodoVisibilityHandler } from "./update-todo-visibility/update-todo-visibility.handler";

export * from "./add-todo-item/add-todo-item.command";
export * from "./add-todo-item/add-todo-item.handler";
export * from "./change-todo-category/change-todo-category.command";
export * from "./change-todo-category/change-todo-category.handler";
export * from "./create-recurring-todos/create-recurring-todos.command";
export * from "./create-recurring-todos/create-recurring-todos.handler";
export * from "./create-todo/create-todo.command";
export * from "./create-todo/create-todo.handler";
export * from "./delete-todo/delete-todo.command";
export * from "./delete-todo/delete-todo.handler";
export * from "./delete-todo-item/delete-todo-item.command";
export * from "./delete-todo-item/delete-todo-item.handler";
export * from "./reorder-todo/reorder-todo.command";
export * from "./reorder-todo/reorder-todo.handler";
export * from "./reorder-todo-items/reorder-todo-items.command";
export * from "./reorder-todo-items/reorder-todo-items.handler";
export * from "./toggle-todo-complete/toggle-todo-complete.command";
export * from "./toggle-todo-complete/toggle-todo-complete.handler";
export * from "./update-todo/update-todo.command";
export * from "./update-todo/update-todo.handler";
export * from "./update-todo-item/update-todo-item.command";
export * from "./update-todo-item/update-todo-item.handler";
export * from "./update-todo-schedule/update-todo-schedule.command";
export * from "./update-todo-schedule/update-todo-schedule.handler";
export * from "./update-todo-title/update-todo-title.command";
export * from "./update-todo-title/update-todo-title.handler";
export * from "./update-todo-visibility/update-todo-visibility.command";
export * from "./update-todo-visibility/update-todo-visibility.handler";

/** 모듈 등록용 커맨드 핸들러 목록 */
export const CommandHandlers = [
	AddTodoItemHandler,
	ChangeTodoCategoryHandler,
	CreateRecurringTodosHandler,
	CreateTodoHandler,
	DeleteTodoHandler,
	DeleteTodoItemHandler,
	ReorderTodoHandler,
	ReorderTodoItemsHandler,
	ToggleTodoCompleteHandler,
	UpdateTodoHandler,
	UpdateTodoItemHandler,
	UpdateTodoScheduleHandler,
	UpdateTodoTitleHandler,
	UpdateTodoVisibilityHandler,
];
