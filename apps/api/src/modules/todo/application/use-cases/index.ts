import { CreateTodoHandler } from "./create-todo/create-todo.handler";
import { ToggleTodoCompleteHandler } from "./toggle-todo-complete/toggle-todo-complete.handler";

export * from "./create-todo/create-todo.command";
export * from "./create-todo/create-todo.handler";
export * from "./toggle-todo-complete/toggle-todo-complete.command";
export * from "./toggle-todo-complete/toggle-todo-complete.handler";

/** 모듈 등록용 커맨드 핸들러 목록 */
export const CommandHandlers = [CreateTodoHandler, ToggleTodoCompleteHandler];
