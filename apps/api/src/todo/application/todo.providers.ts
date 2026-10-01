import { TodoCreatedHandler } from "./events/todo-created.handler.js";
import { TodoDeletedHandler } from "./events/todo-deleted.handler.js";
import { TodoRescheduledHandler } from "./events/todo-rescheduled.handler.js";
import { TodoToggledHandler } from "./events/todo-toggled.handler.js";
import { TodoUpdatedHandler } from "./events/todo-updated.handler.js";
import { GetFriendTodosUseCase } from "./queries/get-friend-todos/get-friend-todos.use-case.js";
import { GetTodoByIdUseCase } from "./queries/get-todo-by-id/get-todo-by-id.use-case.js";
import { GetTodoResourceLimitUseCase } from "./queries/get-todo-resource-limit/get-todo-resource-limit.use-case.js";
import { GetTodoSummaryUseCase } from "./queries/get-todo-summary/get-todo-summary.use-case.js";
import { GetTodosUseCase } from "./queries/get-todos/get-todos.use-case.js";
import { AddTodoItemUseCase } from "./use-cases/add-todo-item/add-todo-item.use-case.js";
import { ChangeTodoCategoryUseCase } from "./use-cases/change-todo-category/change-todo-category.use-case.js";
import { CreateRecurringTodosUseCase } from "./use-cases/create-recurring-todos/create-recurring-todos.use-case.js";
import { CreateTodoUseCase } from "./use-cases/create-todo/create-todo.use-case.js";
import { DeleteTodoItemUseCase } from "./use-cases/delete-todo-item/delete-todo-item.use-case.js";
import { DeleteTodoUseCase } from "./use-cases/delete-todo/delete-todo.use-case.js";
import { ReorderTodoItemsUseCase } from "./use-cases/reorder-todo-items/reorder-todo-items.use-case.js";
import { ReorderTodoUseCase } from "./use-cases/reorder-todo/reorder-todo.use-case.js";
import { ToggleTodoCompleteUseCase } from "./use-cases/toggle-todo-complete/toggle-todo-complete.use-case.js";
import { UpdateTodoItemUseCase } from "./use-cases/update-todo-item/update-todo-item.use-case.js";
import { UpdateTodoScheduleUseCase } from "./use-cases/update-todo-schedule/update-todo-schedule.use-case.js";
import { UpdateTodoTitleUseCase } from "./use-cases/update-todo-title/update-todo-title.use-case.js";
import { UpdateTodoVisibilityUseCase } from "./use-cases/update-todo-visibility/update-todo-visibility.use-case.js";
import { UpdateTodoUseCase } from "./use-cases/update-todo/update-todo.use-case.js";

export const TODO_PROVIDERS = [
	AddTodoItemUseCase,
	ChangeTodoCategoryUseCase,
	CreateRecurringTodosUseCase,
	CreateTodoUseCase,
	DeleteTodoUseCase,
	DeleteTodoItemUseCase,
	ReorderTodoUseCase,
	ReorderTodoItemsUseCase,
	ToggleTodoCompleteUseCase,
	UpdateTodoUseCase,
	UpdateTodoItemUseCase,
	UpdateTodoScheduleUseCase,
	UpdateTodoTitleUseCase,
	UpdateTodoVisibilityUseCase,
	GetTodoByIdUseCase,
	GetTodosUseCase,
	GetFriendTodosUseCase,
	GetTodoResourceLimitUseCase,
	GetTodoSummaryUseCase,
	TodoCreatedHandler,
	TodoDeletedHandler,
	TodoRescheduledHandler,
	TodoToggledHandler,
	TodoUpdatedHandler,
] as const;
