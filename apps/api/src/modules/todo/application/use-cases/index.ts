import { CreateTodoHandler } from "./create-todo/create-todo.handler";
import { ToggleTodoCompleteHandler } from "./toggle-todo-complete/toggle-todo-complete.handler";
import { UpdateTodoHandler } from "./update-todo/update-todo.handler";
import { UpdateTodoScheduleHandler } from "./update-todo-schedule/update-todo-schedule.handler";
import { UpdateTodoTitleHandler } from "./update-todo-title/update-todo-title.handler";
import { UpdateTodoVisibilityHandler } from "./update-todo-visibility/update-todo-visibility.handler";

export * from "./create-todo/create-todo.command";
export * from "./create-todo/create-todo.handler";
export * from "./toggle-todo-complete/toggle-todo-complete.command";
export * from "./toggle-todo-complete/toggle-todo-complete.handler";
export * from "./update-todo/update-todo.command";
export * from "./update-todo/update-todo.handler";
export * from "./update-todo-schedule/update-todo-schedule.command";
export * from "./update-todo-schedule/update-todo-schedule.handler";
export * from "./update-todo-title/update-todo-title.command";
export * from "./update-todo-title/update-todo-title.handler";
export * from "./update-todo-visibility/update-todo-visibility.command";
export * from "./update-todo-visibility/update-todo-visibility.handler";

/** 모듈 등록용 커맨드 핸들러 목록 */
export const CommandHandlers = [
	CreateTodoHandler,
	ToggleTodoCompleteHandler,
	UpdateTodoHandler,
	UpdateTodoScheduleHandler,
	UpdateTodoTitleHandler,
	UpdateTodoVisibilityHandler,
];
