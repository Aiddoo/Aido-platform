import { GetFriendTodosHandler } from "./get-friend-todos.handler";
import { GetTodoByIdHandler } from "./get-todo-by-id.handler";
import { GetTodoResourceLimitHandler } from "./get-todo-resource-limit.handler";
import { GetTodosHandler } from "./get-todos.handler";

/** 모듈 등록용 쿼리 핸들러 목록 */
export const QueryHandlers = [
	GetTodoByIdHandler,
	GetTodosHandler,
	GetFriendTodosHandler,
	GetTodoResourceLimitHandler,
];
