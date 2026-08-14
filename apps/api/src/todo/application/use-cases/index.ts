import { AddTodoItemUseCase } from "./add-todo-item/add-todo-item.use-case";
import { ChangeTodoCategoryUseCase } from "./change-todo-category/change-todo-category.use-case";
import { CreateRecurringTodosUseCase } from "./create-recurring-todos/create-recurring-todos.use-case";
import { CreateTodoUseCase } from "./create-todo/create-todo.use-case";
import { DeleteTodoUseCase } from "./delete-todo/delete-todo.use-case";
import { DeleteTodoItemUseCase } from "./delete-todo-item/delete-todo-item.use-case";
import { ReorderTodoUseCase } from "./reorder-todo/reorder-todo.use-case";
import { ReorderTodoItemsUseCase } from "./reorder-todo-items/reorder-todo-items.use-case";
import { ToggleTodoCompleteUseCase } from "./toggle-todo-complete/toggle-todo-complete.use-case";
import { UpdateTodoUseCase } from "./update-todo/update-todo.use-case";
import { UpdateTodoItemUseCase } from "./update-todo-item/update-todo-item.use-case";
import { UpdateTodoScheduleUseCase } from "./update-todo-schedule/update-todo-schedule.use-case";
import { UpdateTodoTitleUseCase } from "./update-todo-title/update-todo-title.use-case";
import { UpdateTodoVisibilityUseCase } from "./update-todo-visibility/update-todo-visibility.use-case";

export {
	AddTodoItemUseCase,
	ChangeTodoCategoryUseCase,
	CreateRecurringTodosUseCase,
	CreateTodoUseCase,
	DeleteTodoItemUseCase,
	DeleteTodoUseCase,
	ReorderTodoItemsUseCase,
	ReorderTodoUseCase,
	ToggleTodoCompleteUseCase,
	UpdateTodoItemUseCase,
	UpdateTodoScheduleUseCase,
	UpdateTodoTitleUseCase,
	UpdateTodoUseCase,
	UpdateTodoVisibilityUseCase,
};

/** Todo 커맨드 use-case (모듈 등록용 배럴). */
export const TodoUseCases = [
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
];
