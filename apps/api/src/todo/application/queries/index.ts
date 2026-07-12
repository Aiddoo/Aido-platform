import { GetFriendTodosUseCase } from "./get-friend-todos/get-friend-todos.use-case";
import { GetTodoByIdUseCase } from "./get-todo-by-id/get-todo-by-id.use-case";
import { GetTodoResourceLimitUseCase } from "./get-todo-resource-limit/get-todo-resource-limit.use-case";
import { GetTodoSummaryUseCase } from "./get-todo-summary/get-todo-summary.use-case";
import { GetTodosUseCase } from "./get-todos/get-todos.use-case";

/** Todo 쿼리 use-case (모듈 등록용 배럴). */
export const TodoQueryUseCases = [
	GetTodoByIdUseCase,
	GetTodosUseCase,
	GetFriendTodosUseCase,
	GetTodoResourceLimitUseCase,
	GetTodoSummaryUseCase,
];
