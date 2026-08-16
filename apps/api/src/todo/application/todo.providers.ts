import { TodoCreatedHandler } from "./events/todo-created.handler";
import { TodoDeletedHandler } from "./events/todo-deleted.handler";
import { TodoRescheduledHandler } from "./events/todo-rescheduled.handler";
import { TodoToggledHandler } from "./events/todo-toggled.handler";
import { TodoUpdatedHandler } from "./events/todo-updated.handler";
import { GetFriendTodosUseCase } from "./queries/get-friend-todos/get-friend-todos.use-case";
import { GetTodoByIdUseCase } from "./queries/get-todo-by-id/get-todo-by-id.use-case";
import { GetTodoResourceLimitUseCase } from "./queries/get-todo-resource-limit/get-todo-resource-limit.use-case";
import { GetTodoSummaryUseCase } from "./queries/get-todo-summary/get-todo-summary.use-case";
import { GetTodosUseCase } from "./queries/get-todos/get-todos.use-case";
import { AddTodoItemUseCase } from "./use-cases/add-todo-item/add-todo-item.use-case";
import { ChangeTodoCategoryUseCase } from "./use-cases/change-todo-category/change-todo-category.use-case";
import { CreateRecurringTodosUseCase } from "./use-cases/create-recurring-todos/create-recurring-todos.use-case";
import { CreateTodoUseCase } from "./use-cases/create-todo/create-todo.use-case";
import { DeleteTodoItemUseCase } from "./use-cases/delete-todo-item/delete-todo-item.use-case";
import { DeleteTodoUseCase } from "./use-cases/delete-todo/delete-todo.use-case";
import { ReorderTodoItemsUseCase } from "./use-cases/reorder-todo-items/reorder-todo-items.use-case";
import { ReorderTodoUseCase } from "./use-cases/reorder-todo/reorder-todo.use-case";
import { ToggleTodoCompleteUseCase } from "./use-cases/toggle-todo-complete/toggle-todo-complete.use-case";
import { UpdateTodoItemUseCase } from "./use-cases/update-todo-item/update-todo-item.use-case";
import { UpdateTodoScheduleUseCase } from "./use-cases/update-todo-schedule/update-todo-schedule.use-case";
import { UpdateTodoTitleUseCase } from "./use-cases/update-todo-title/update-todo-title.use-case";
import { UpdateTodoVisibilityUseCase } from "./use-cases/update-todo-visibility/update-todo-visibility.use-case";
import { UpdateTodoUseCase } from "./use-cases/update-todo/update-todo.use-case";

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
